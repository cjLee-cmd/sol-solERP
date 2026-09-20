'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// 쓰기 권한은 RLS(programs_insert/update/delete = is_master())가 강제합니다.
// 아래 액션들은 UI 편의일 뿐, 권한의 최종 방어선이 아닙니다.

export type TestResult = {
  ok: boolean
  embedMode: 'iframe' | 'window'
  message: string
}

/**
 * 연결 테스트 — 대상이 iframe 임베드를 허용하는지 응답 헤더로 판정합니다.
 * 막혀 있으면 '새 창' 모드로 등록하면 됩니다.
 */
export async function testConnection(rawUrl: string): Promise<TestResult> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, embedMode: 'window', message: '올바른 URL이 아닙니다' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, embedMode: 'window', message: 'http/https 주소만 등록할 수 있습니다' }
  }

  let res: Response
  try {
    res = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(6000) })
  } catch {
    return { ok: false, embedMode: 'window', message: '응답이 없습니다 (주소·네트워크 확인)' }
  }

  if (!res.ok) {
    return { ok: false, embedMode: 'window', message: `응답 코드 ${res.status}` }
  }

  // 차일드는 마더의 중계 경로(/x/...)로 띄우고, 중계가 X-Frame-Options 와
  // CSP frame-ancestors 를 걷어내므로 차일드의 프레임 정책은 더 이상 걸림돌이 아니다.
  return {
    ok: true,
    embedMode: 'iframe',
    message: '임베드 가능 — 메인 창 안(iframe)으로 등록합니다',
  }
}


export async function addProgram(input: {
  name_en: string
  name_ko: string
  url: string
  embed_mode: 'iframe' | 'window'
}) {
  const supabase = await createClient()

  const { data: last } = await supabase
    .from('programs')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>()

  const { error } = await supabase.from('programs').insert({
    ...input,
    sort_order: (last?.sort_order ?? 0) + 1,
  })

  if (error) return { error: error.message }
  revalidatePath('/')
  return {}
}

export async function updateProgram(
  id: string,
  input: {
    name_en: string
    name_ko: string
    url: string
    embed_mode: 'iframe' | 'window'
  }
) {
  const supabase = await createClient()
  const { error } = await supabase.from('programs').update(input).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  return {}
}

export async function setProgramEnabled(id: string, enabled: boolean) {
  const supabase = await createClient()
  const { error } = await supabase.from('programs').update({ enabled }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  return {}
}

export async function deleteProgram(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('programs').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  return {}
}

/** 두 프로그램의 sort_order 를 맞바꿔 순서를 한 칸 옮깁니다. */
export async function swapProgramOrder(a: string, b: string) {
  const supabase = await createClient()

  const { data: rows, error: readError } = await supabase
    .from('programs')
    .select('id, sort_order')
    .in('id', [a, b])
    .returns<{ id: string; sort_order: number }[]>()

  if (readError) return { error: readError.message }
  if (!rows || rows.length !== 2) return { error: '대상을 찾지 못했습니다' }

  const [first, second] = rows
  const results = await Promise.all([
    supabase.from('programs').update({ sort_order: second.sort_order }).eq('id', first.id),
    supabase.from('programs').update({ sort_order: first.sort_order }).eq('id', second.id),
  ])

  const failed = results.find((r) => r.error)
  if (failed?.error) return { error: failed.error.message }

  revalidatePath('/')
  return {}
}
