import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// 로그인 없이 접근할 수 있어야 하는 경로.
// 차일드 SDK는 다른 오리진의 비로그인 페이지가 불러가므로 반드시 공개여야 한다.
const PUBLIC_PREFIXES = ['/login', '/solerp-child.js', '/dev/']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          )
        },
      },
    }
  )

  // createServerClient 와 getClaims() 사이에 코드를 넣지 말 것.
  // 사용자가 무작위로 로그아웃되는 디버깅하기 어려운 문제가 생긴다.
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims

  const { pathname } = request.nextUrl
  // 정적 파일(로그인 화면 로고 등)은 matcher 가 더 이상 거르지 않으므로 여기서 공개 처리한다.
  const isPublic =
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    /\.(?:svg|png|jpe?g|gif|webp)$/i.test(pathname)

  if (!claims && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (claims && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // supabaseResponse 를 그대로 반환해야 한다. 쿠키를 옮기지 않고 새 응답을 만들면
  // 브라우저와 서버의 세션이 어긋나 조기 로그아웃이 발생한다.
  return supabaseResponse
}
