'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ActivityEntry, Program } from '@/lib/types'
import styles from './HubShell.module.css'

const MAX_ENTRIES = 50

function relative(iso: string, now: number) {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const min = Math.floor(diff / 60_000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}시간 전`
  return `${Math.floor(hour / 24)}일 전`
}

/**
 * 와이어프레임 2a 하단 상태바 — 스펙 7줄 "실시간으로 서로의 작업 내용을 확인".
 * 어떤 로그가 보이는지는 RLS 가 결정합니다 (Master 는 전체, Sub 는 본인 것만).
 */
export function ActivityBar({
  initial,
  programs,
}: {
  initial: ActivityEntry[]
  programs: Program[]
}) {
  const supabase = useMemo(() => createClient(), [])
  const [entries, setEntries] = useState(initial)
  const [open, setOpen] = useState(false)

  // 서버와 클라이언트의 '지금'이 달라 하이드레이션이 어긋나므로 마운트 후에만 계산한다
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const nameOf = useMemo(() => {
    const map = new Map(programs.map((p) => [p.id, p.name_en]))
    return (id: string | null) => (id && map.get(id)) || '시스템'
  }, [programs])

  useEffect(() => {
    const channel = supabase
      .channel('solerp-activity')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        (payload) => {
          const row = payload.new as ActivityEntry
          setEntries((prev) =>
            prev.some((e) => e.id === row.id) ? prev : [row, ...prev].slice(0, MAX_ENTRIES)
          )
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase])

  const latest = entries[0]

  return (
    <>
      <div className={styles.activityBar}>
        <span className={`${styles.dot} ${latest ? styles.dotOn : ''}`} />
        {latest ? (
          <span className={styles.activityText}>
            {nameOf(latest.program_id)} · {latest.message}
            {now !== null && ` · ${relative(latest.created_at, now)}`}
          </span>
        ) : (
          <span className={styles.activityText}>아직 기록된 활동이 없습니다</span>
        )}
        <button type="button" className={styles.activityMore} onClick={() => setOpen(true)}>
          전체 로그 ›
        </button>
      </div>

      {open && (
        <div className={styles.backdrop} onClick={() => setOpen(false)}>
          <div
            className={styles.logPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="log-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.logHead}>
              <span id="log-title" className={styles.logTitle}>활동 로그</span>
              <button
                type="button"
                className={styles.close}
                aria-label="닫기"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>

            {entries.length === 0 ? (
              <div className={styles.logEmpty}>아직 기록된 활동이 없습니다</div>
            ) : (
              <ul className={styles.logList}>
                {entries.map((e) => (
                  <li key={e.id} className={styles.logItem}>
                    <span className={styles.logProgram}>{nameOf(e.program_id)}</span>
                    <span className={styles.logMessage}>{e.message}</span>
                    <span className={styles.logTime}>
                      {now !== null ? relative(e.created_at, now) : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  )
}
