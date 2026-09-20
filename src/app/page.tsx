import { HubShell } from '@/components/hub/HubShell'
import type { Conn } from '@/components/hub/useConnections'
import { createClient } from '@/lib/supabase/server'
import type { ActivityEntry, Profile, Program } from '@/lib/types'
import { logout } from './login/actions'

type OpenSession = {
  id: string
  token: string
  program_id: string
  status: 'connecting' | 'connected'
}

export default async function Page() {
  const supabase = await createClient()

  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims.sub as string

  const [{ data: profile }, { data: programs }, { data: sessions }, { data: activity }] =
    await Promise.all([
      supabase.from('profiles').select('display_name, role').eq('id', userId).single<Profile>(),
      supabase
        .from('programs')
        .select('id, name_en, name_ko, url, embed_mode, accent_token, enabled')
        .order('sort_order')
        .returns<Program[]>(),
      // 새로고침해도 열려 있던 연결이 복원되도록 — 창 핸들은 사라져도 세션은 남는다
      supabase
        .from('sessions')
        .select('id, token, program_id, status')
        .eq('profile_id', userId)
        .in('status', ['connecting', 'connected'])
        .order('started_at')
        .returns<OpenSession[]>(),
      // 어떤 로그가 보이는지는 RLS 가 결정한다 (Master 는 전체, Sub 는 본인 것만)
      supabase
        .from('activity_log')
        .select('id, message, created_at, program_id')
        .order('created_at', { ascending: false })
        .limit(50)
        .returns<ActivityEntry[]>(),
    ])

  const byId = new Map((programs ?? []).map((p) => [p.id, p]))
  const initialConns: Conn[] = (sessions ?? []).flatMap((s) => {
    const program = byId.get(s.program_id)
    return program ? [{ id: s.id, token: s.token, program, status: s.status }] : []
  })

  return (
    <HubShell
      profileId={userId}
      profile={profile ?? { display_name: '', role: 'sub' }}
      programs={programs ?? []}
      initialConns={initialConns}
      initialActivity={activity ?? []}
      onLogout={logout}
    />
  )
}
