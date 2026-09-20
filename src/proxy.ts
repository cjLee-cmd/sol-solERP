import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

/** 마더 자신의 경로. 이 밖의 경로는 마더에 없으므로 차일드가 만든 것으로 본다. */
const MOTHER_PATHS = ['/login', '/settings', '/dev', '/x', '/solerp-child.js', '/_next', '/logo_header2.png']

const CHILD_BASE = /^\/x\/([0-9a-f-]{36})(?=\/|$)/

/**
 * 차일드가 런타임에 만든 루트 절대경로(`/demo/staff/f30-01.webp`, `/api/...`)는 중계의
 * 본문 재작성이 잡지 못한다(템플릿 리터럴·문자열 결합). 브라우저는 그걸 마더 오리진으로
 * 요청하므로, Referer 가 `/x/<id>/...` 이면 그 프로그램의 중계 경로로 되돌린다.
 * (INSA Flow '사람별 투입 현황' 사진이 마더 안에서만 빠지던 원인)
 */
function childFallback(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === '/' || MOTHER_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null
  }
  const referer = request.headers.get('referer')
  if (!referer) return null
  let refPath: string
  try {
    refPath = new URL(referer).pathname
  } catch {
    return null
  }
  const programId = CHILD_BASE.exec(refPath)?.[1]
  if (!programId) return null

  const url = request.nextUrl.clone()
  url.pathname = `/x/${programId}${pathname}`
  return NextResponse.rewrite(url)
}

export async function proxy(request: NextRequest) {
  const session = await updateSession(request)
  if (session.headers.has('location')) return session
  return childFallback(request) ?? session
}

export const config = {
  // 정적 확장자도 거쳐야 차일드 사진(/demo/...webp) 되돌리기가 동작한다.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
