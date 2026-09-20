// 차일드 프로그램 동일 오리진 중계(reverse proxy).
//
// 왜 필요한가: 마더와 차일드가 서로 다른 사이트(*.vercel.app 은 Public Suffix 라
// 서브도메인끼리 남남)면, 차일드의 SameSite=Lax 세션 쿠키가 iframe 안에서 전송되지
// 않아 로그인이 안 된다. 이 라우트를 거치면 브라우저 입장에서 차일드가 마더와 같은
// 오리진이 되므로 쿠키가 1st-party 가 되어 그대로 동작한다.
//
// 이건 도메인을 같은 등록 도메인으로 정리하기 전까지의 다리(bridge)다.
// hub.solideos.com / insa.solideos.com 이 붙으면 이 경로는 필요 없어진다.

import { createClient } from '@/lib/supabase/server'

/**
 * HTML 속성 밖(인라인 스크립트, RSC 페이로드 등)에서도 다시 써야 하는 절대경로 접두사.
 * JS/JSON 본문은 임의 문자열을 건드리면 위험하므로 이 목록으로만 제한한다.
 */
const ABSOLUTE_PREFIXES = ['_next', 'api', 'icon.svg', 'favicon.ico']

/** 텍스트로 취급해 경로를 다시 쓸 콘텐츠 타입 */
const REWRITABLE = /\b(text\/html|text\/css|javascript|application\/json|text\/x-component)\b/i

/**
 * 차일드가 자기 프론트와 다른 오리진의 백엔드를 호출하고, 그 백엔드가 요청 Origin 을
 * 자기 프론트 주소로만 허용하는 경우(TRAVEL: CORS preflight 400 + 서버측 403 origin_rejected).
 * 마더 안에서 뜬 차일드는 Origin 이 마더가 되므로 백엔드 호출도 마더가 중계한다:
 * JS 안의 백엔드 주소를 `/x/<id>/__api` 로 바꾸고, 그 경로로 온 요청은 아래 백엔드로 넘긴다.
 * 키는 차일드 프론트의 오리진. 경로에서 호스트를 받지 않는 이유는 이 라우트가
 * 아무 곳으로나 보내는 열린 프록시가 되지 않게 하기 위해서다.
 */
const API_ORIGINS: Record<string, string> = {
  'https://korail-ktx-mobile.vercel.app': 'https://east.tailcd3906.ts.net',
}
const API_SEGMENT = '__api'

/**
 * 차일드로 그대로 넘기면 안 되는 요청 헤더.
 * 조건부 요청(if-none-match 등)을 넘기면 차일드가 304 를 주고, 브라우저는 재작성 규칙이
 * 바뀌기 전의 옛 본문을 계속 쓴다(실제로 겪음). 항상 전체 본문을 받아 새로 재작성한다.
 */
const STRIP_REQUEST_HEADERS = [
  'host',
  'connection',
  'accept-encoding',
  'cookie',
  'content-length',
  'if-none-match',
  'if-modified-since',
]


/** 차일드 응답에서 우리가 다시 만들 헤더 */
const STRIP_RESPONSE_HEADERS = ['content-encoding', 'content-length', 'transfer-encoding', 'set-cookie']

/**
 * 차일드는 마더 오리진의 /x/... 경로로 서빙되므로 "누가 나를 프레임에 넣을 수 있는가"는
 * 이제 마더가 정한다. 차일드가 보낸 X-Frame-Options 와 CSP frame-ancestors 는
 * 마더 자신의 iframe 을 막아 버리므로 중계 단계에서 걷어낸다. (TRAVEL 이 frame-ancestors 'none' 을 보냄)
 */
function stripFramePolicy(headers: Headers) {
  headers.delete('x-frame-options')
  for (const name of ['content-security-policy', 'content-security-policy-report-only']) {
    const csp = headers.get(name)
    if (!csp) continue
    const kept = csp
      .split(';')
      .map((d) => d.trim())
      .filter((d) => d && !/^frame-ancestors\b/i.test(d))
    if (kept.length) headers.set(name, kept.join('; '))
    else headers.delete(name)
  }
}

/**
 * 차일드 쿠키는 마더 오리진에 저장되므로 이름 충돌과 유출을 막기 위해 접두사를 붙인다.
 * 이 접두사가 없는 쿠키(= 마더의 Supabase 세션 등)는 절대 차일드로 넘기지 않는다.
 */
function cookiePrefix(programId: string) {
  return `cx_${programId.replace(/-/g, '').slice(0, 12)}_`
}

function rewriteBody(text: string, base: string, contentType: string, apiOrigin?: string) {
  let out = text

  // 별도 백엔드 주소는 통째로 마더 중계 경로로 바꾼다(리터럴 종류와 무관하게 전부).
  // 다른 오리진의 API 를 Bearer 로 부르던 코드는 쿠키를 안 보내는데(credentials: omit),
  // 중계는 마더 오리진이라 마더 세션 쿠키가 있어야 로그인 게이트를 통과한다(없으면 307 → /login).
  if (apiOrigin) {
    out = out.split(apiOrigin).join(`${base}/${API_SEGMENT}`)
    out = out.replace(/credentials\s*:\s*(["'`])omit\1/g, 'credentials:$1same-origin$1')
  }

  // 차일드마다 자산 경로가 제각각이라(Next.js 는 /_next/, 정적 앱은 /app.js /styles.css …)
  // 고정 목록 대신 HTML 속성 단위로 루트 절대경로를 통째로 옮긴다.
  if (/text\/html/i.test(contentType)) {
    out = out.replace(
      /(\s(?:src|href|action|poster|formaction|data-src)\s*=\s*["'])\/(?!\/)/gi,
      `$1${base}/`
    )
  }

  // CSS 안의 url(/...) 도 같은 이유로 옮긴다.
  if (/text\/css/i.test(contentType)) {
    out = out.replace(/(url\(\s*["']?)\/(?!\/)/gi, `$1${base}/`)
  }

  // SPA 는 자산 경로를 런타임에 만든다(동적 import, JS 안의 이미지 경로 등).
  // 정적 자산 확장자로 끝나는 문자열 리터럴만 골라 옮긴다 — 데이터성 문자열을
  // 건드리지 않으면서 /art/..., /assets/... 같은 앱별 경로를 일반적으로 처리한다.
  out = out.replace(
    /(["'`])(\/(?!\/)[\w.\-/]*\.(?:m?js|css|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|mp3|mp4|wav|json|webmanifest))(["'`])/gi,
    (match, open, path: string, close) =>
      path.startsWith(`${base}/`) ? match : `${open}${base}${path}${close}`
  )

  // 속성 밖(인라인 스크립트·RSC 페이로드·JSON)은 알려진 접두사만 보수적으로 바꾼다.
  for (const prefix of ABSOLUTE_PREFIXES) {
    const re = new RegExp(`(["'(=,\\s])\\/${prefix.replace('.', '\\.')}`, 'g')
    out = out.replace(re, `$1${base}/${prefix}`)
  }

  return out
}

async function proxy(
  request: Request,
  ctx: { params: Promise<{ program: string; path?: string[] }> }
) {
  const { program: programId, path = [] } = await ctx.params

  // 등록된 프로그램만 중계한다. RLS 가 걸려 있어 볼 수 없는 프로그램은 여기서 막힌다.
  const supabase = await createClient()
  const { data: program } = await supabase
    .from('programs')
    .select('url')
    .eq('id', programId)
    .single<{ url: string }>()

  if (!program) {
    return new Response('등록되지 않은 프로그램입니다', { status: 404 })
  }

  // 차일드의 service worker 는 마더 오리진의 /x/<id>/ 범위에 설치되어 재작성된 자산을
  // 자체 캐시에서 서빙한다. 그러면 마더의 재작성 규칙이 바뀌어도 옛 본문이 계속 쓰이므로
  // (TRAVEL 의 workbox precache 로 실제로 겪음) 스크립트 요청에 404 를 준다 —
  // 새 등록은 실패하고, 기존 등록은 다음 갱신 검사에서 브라우저가 해제한다.
  if (request.headers.get('service-worker') === 'script') {
    return new Response(null, { status: 404 })
  }

  const origin = new URL(program.url).origin
  const apiOrigin = API_ORIGINS[origin]
  const isApi = apiOrigin !== undefined && path[0] === API_SEGMENT
  const requestUrl = new URL(request.url)
  const target = new URL(
    `${isApi ? apiOrigin : origin}/${(isApi ? path.slice(1) : path).join('/')}`
  )
  target.search = requestUrl.search

  const base = `/x/${programId}`
  const prefix = cookiePrefix(programId)

  // ── 요청 헤더 ──────────────────────────────────────────
  const headers = new Headers()
  request.headers.forEach((value, key) => {
    if (!STRIP_REQUEST_HEADERS.includes(key.toLowerCase())) headers.set(key, value)
  })
  // 업스트림에는 마더가 아니라 차일드 프론트 자신이 보낸 요청으로 보이게 한다.
  // 브라우저의 Origin/Referer(마더 주소)를 그대로 넘기면 자기 주소만 허용하는 백엔드에 걸린다.
  headers.set('origin', origin)
  headers.set('referer', `${origin}/`)
  headers.set('accept-encoding', 'identity')

  // 접두사가 붙은 차일드 쿠키만 원래 이름으로 되돌려 전달한다.
  // 마더의 세션 쿠키(sb-*)는 여기서 걸러져 차일드로 새지 않는다.
  const forwarded = request.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .filter((c) => c.startsWith(prefix))
    .map((c) => c.slice(prefix.length))
    .join('; ')
  if (forwarded) headers.set('cookie', forwarded)

  const method = request.method
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer()

  let upstream: Response
  try {
    upstream = await fetch(target, { method, headers, body, redirect: 'manual' })
  } catch {
    return new Response('차일드 프로그램에 연결하지 못했습니다', { status: 502 })
  }

  // ── 응답 헤더 ──────────────────────────────────────────
  const responseHeaders = new Headers()
  upstream.headers.forEach((value, key) => {
    if (!STRIP_RESPONSE_HEADERS.includes(key.toLowerCase())) responseHeaders.set(key, value)
  })
  stripFramePolicy(responseHeaders)

  // 리다이렉트는 중계 경로로 되돌린다
  const location = upstream.headers.get('location')
  if (location) {
    const abs = new URL(location, origin)
    responseHeaders.set(
      'location',
      abs.origin === origin ? `${base}${abs.pathname}${abs.search}` : abs.toString()
    )
  }

  // Set-Cookie 는 이름에 접두사를 붙이고 경로를 중계 경로로 좁힌다.
  // 이 시점에서 쿠키는 마더 오리진의 1st-party 쿠키가 되므로 SameSite=Lax 도 잘 동작한다.
  for (const cookie of upstream.headers.getSetCookie()) {
    const [pair, ...attrs] = cookie.split(';')
    const eq = pair.indexOf('=')
    if (eq < 0) continue

    const rebuilt = [`${prefix}${pair.slice(0, eq).trim()}=${pair.slice(eq + 1)}`]
    for (const attr of attrs) {
      const name = attr.trim().split('=')[0].toLowerCase()
      if (name === 'domain') continue // 오리진이 바뀌었으므로 버린다
      if (name === 'path') continue // 아래에서 다시 설정
      rebuilt.push(attr.trim())
    }
    rebuilt.push(`Path=${base}`)
    responseHeaders.append('set-cookie', rebuilt.join('; '))
  }

  // ── 본문 ───────────────────────────────────────────────
  const contentType = upstream.headers.get('content-type') ?? ''
  // 백엔드 API 응답은 데이터이므로 경로 재작성을 하지 않는다.
  // 단, 스트림을 그대로 넘기면 업스트림이 끊길 때 본문이 잘려 클라이언트가 JSON 파싱에
  // 실패한다(TRAVEL 로그인 200 이 status 0 으로 남고 앱은 일반 오류를 띄움). SSE 만
  // 스트림으로 두고 나머지 API 응답은 통째로 받아 완결된 본문으로 보낸다.
  if (isApi && !/text\/event-stream/i.test(contentType)) {
    const buffered = await upstream.arrayBuffer()
    responseHeaders.delete('content-length')
    return new Response(buffered, { status: upstream.status, headers: responseHeaders })
  }
  if (isApi || !REWRITABLE.test(contentType)) {
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
  }

  const rewritten = rewriteBody(await upstream.text(), base, contentType, apiOrigin)
  responseHeaders.delete('content-length')
  // 재작성된 본문은 차일드의 장기 캐시·검증 헤더를 그대로 쓰면 안 된다.
  // 재작성 규칙이 바뀌었을 때 브라우저가 옛 결과를 계속 쓰게 된다(실제로 겪음).
  responseHeaders.set('cache-control', 'no-cache')
  responseHeaders.delete('etag')
  responseHeaders.delete('last-modified')
  return new Response(rewritten, { status: upstream.status, headers: responseHeaders })
}

// 차일드 백엔드(개인 PC·Tailscale)는 느릴 수 있고 SSE 는 오래 열린다. 기본 시간에 잘리지 않게 한다.
export const maxDuration = 60

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
export const HEAD = proxy
export const OPTIONS = proxy
