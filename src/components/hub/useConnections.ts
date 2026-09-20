'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Program } from '@/lib/types'

export type Conn = {
  id: string
  token: string
  program: Program
  status: 'connecting' | 'connected'
}

export function childUrl(base: string, session: string, token: string) {
  const url = new URL(base)
  url.searchParams.set('solerp_session', session)
  url.searchParams.set('solerp_token', token)
  return url.toString()
}

/**
 * iframe 으로 띄울 때는 마더의 중계 경로(/x/...)를 쓴다.
 * 그래야 차일드가 브라우저 입장에서 같은 오리진이 되어 세션 쿠키가 살아남는다.
 * 새 창은 어차피 최상위 컨텍스트라 원래 주소를 그대로 쓴다.
 */
export function childSrc(program: Program, session: string, token: string) {
  if (program.embed_mode !== 'iframe') {
    return childUrl(program.url, session, token)
  }
  const { pathname, search } = new URL(program.url)
  const params = new URLSearchParams(search)
  params.set('solerp_session', session)
  params.set('solerp_token', token)
  return `/x/${program.id}${pathname}?${params}`
}

export function useConnections(profileId: string, initial: Conn[]) {
  const supabase = useMemo(() => createClient(), [])
  const [conns, setConns] = useState<Conn[]>(initial)
  const [activeId, setActiveId] = useState<string | null>(initial[0]?.id ?? null)

  // 마더가 window.open 으로 연 창들. 새로고침하면 사라지므로 종료의 유일한
  // 수단일 수 없다 — 세션 취소(status='closed')가 그 역할을 한다.
  const handles = useRef(new Map<string, Window>())

  // 이미 'connected' 로 올린 세션. 중복 DB 갱신을 막는다.
  const marked = useRef(new Set<string>())

  const drop = useCallback((id: string) => {
    handles.current.delete(id)
    setConns((prev) => {
      if (!prev.some((c) => c.id === id)) return prev
      const next = prev.filter((c) => c.id !== id)
      setActiveId((cur) => (cur === id ? (next[next.length - 1]?.id ?? null) : cur))
      return next
    })
  }, [])

  const connect = useCallback(
    (program: Program) => {
      const id = crypto.randomUUID()
      const token = crypto.randomUUID()

      // 팝업 차단을 피하려면 클릭 핸들러 안에서 동기적으로 열어야 한다.
      // 그래서 세션 id/token 을 클라이언트에서 먼저 만들고 DB 기록은 뒤로 미룬다.
      const openInWindow = program.embed_mode === 'window'
      const win = openInWindow
        ? window.open(childUrl(program.url, id, token), `solerp_${id}`)
        : null

      if (openInWindow && !win) {
        console.error('[solERP] 팝업이 차단되어 창을 열지 못했습니다')
        alert('브라우저가 팝업을 차단했습니다. 이 사이트의 팝업을 허용한 뒤 다시 시도하세요.')
        return
      }
      if (win) handles.current.set(id, win)

      // 차일드 SDK 를 넣지 않은 프로그램도 있으므로 ack 에만 의존하지 않는다.
      // 새 창은 우리가 연 시점에 연결된 것으로 보고, iframe 은 load 시점에 올린다.
      // SDK 가 있으면 ack 가 Realtime 으로 들어와 같은 상태로 수렴한다.
      const status: Conn['status'] = openInWindow ? 'connected' : 'connecting'
      if (openInWindow) marked.current.add(id)

      setConns((prev) => [...prev, { id, token, program, status }])
      setActiveId(id)

      supabase
        .from('sessions')
        .insert({ id, token, profile_id: profileId, program_id: program.id, status })
        .then(({ error }) => {
          if (!error) return
          console.error('[solERP] 세션 생성 실패', error.message)
          win?.close()
          drop(id)
        })
    },
    [supabase, profileId, drop]
  )

  /** iframe 이 뜨면 연결됨으로 올린다. 중복 호출은 무시한다. */
  const markConnected = useCallback(
    (id: string) => {
      if (marked.current.has(id)) return
      marked.current.add(id)

      setConns((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'connected' } : c)))
      supabase
        .from('sessions')
        .update({ status: 'connected' })
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('[solERP] 세션 상태 갱신 실패', error.message)
        })
    },
    [supabase]
  )

  // 스펙 11줄 — 연결을 끊으면 차일드가 꺼진다.
  // ① 창 핸들이 있으면 즉시 닫고 ② 세션을 취소해 차일드 SDK 가 스스로 닫게 한다.
  // ②가 있어서 마더를 새로고침해 핸들을 잃은 뒤에도, 사용자가 URL 로 직접 연
  // 창에서도 종료가 동작한다.
  const disconnect = useCallback(
    (id: string) => {
      handles.current.get(id)?.close()
      drop(id)

      // PostgREST 빌더는 then() 을 호출해야 요청이 나간다.
      // `void supabase...update()` 로 두면 조용히 실행되지 않는다.
      supabase
        .from('sessions')
        .update({ status: 'closed', ended_at: new Date().toISOString() })
        .eq('id', id)
        .then(({ error }) => {
          if (error) console.error('[solERP] 세션 취소 실패', error.message)
        })
    },
    [supabase, drop]
  )

  // 차일드의 ack 와 (Master 의) 강제 종료를 실시간으로 반영
  useEffect(() => {
    const channel = supabase
      .channel('solerp-sessions')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `profile_id=eq.${profileId}`,
        },
        (payload) => {
          const row = payload.new as { id: string; status: Conn['status'] | 'closed' }
          if (row.status === 'closed') {
            handles.current.get(row.id)?.close()
            drop(row.id)
            return
          }
          setConns((prev) =>
            prev.map((c) => (c.id === row.id ? { ...c, status: row.status as Conn['status'] } : c))
          )
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, profileId, drop])

  // 사용자가 차일드 창을 직접 닫았으면 탭도 정리한다
  useEffect(() => {
    const timer = setInterval(() => {
      for (const [id, win] of handles.current) {
        if (win.closed) disconnect(id)
      }
    }, 2000)
    return () => clearInterval(timer)
  }, [disconnect])

  const active = conns.find((c) => c.id === activeId) ?? null

  return { conns, active, activeId, setActiveId, connect, disconnect, markConnected }
}
