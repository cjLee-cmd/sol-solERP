'use client'

import { useState } from 'react'
import { SettingsDialog } from '@/components/settings/SettingsDialog'
import type { ActivityEntry, Profile, Program } from '@/lib/types'
import { ActivityBar } from './ActivityBar'
import { DisconnectDialog } from './DisconnectDialog'
import { Stage } from './Stage'
import { useConnections, type Conn } from './useConnections'
import styles from './HubShell.module.css'

// 와이어프레임 app.js 의 레일 로직: 핀 고정이거나 마우스가 올라가면 펼침
const RAIL_FULL = 212
const RAIL_COLLAPSED = 48

export function HubShell({
  profileId,
  profile,
  programs,
  initialConns,
  initialActivity,
  onLogout,
}: {
  profileId: string
  profile: Profile
  programs: Program[]
  initialConns: Conn[]
  initialActivity: ActivityEntry[]
  onLogout: () => void
}) {
  const [pinned, setPinned] = useState(true)
  const [hovered, setHovered] = useState(false)
  const [pendingDisconnect, setPendingDisconnect] = useState<Conn | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const { conns, active, activeId, setActiveId, connect, disconnect, markConnected } =
    useConnections(profileId, initialConns)

  const open = pinned || hovered
  const isMaster = profile.role === 'master'

  return (
    <div className={styles.window}>
      <aside
        className={`${styles.rail} ${open ? '' : styles.railClosed}`}
        style={{ width: open ? RAIL_FULL : RAIL_COLLAPSED }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className={styles.railInner}>
          <div className={styles.railHead}>
            <span className={styles.light} />
            <span className={styles.light} />
            <span className={styles.light} />
            <span className={styles.spacer} />
            <button
              type="button"
              className={styles.pin}
              title="사이드바 고정"
              aria-label="사이드바 고정"
              aria-pressed={pinned}
              onClick={() => setPinned((v) => !v)}
            >
              📌
            </button>
          </div>

          <div className={`${styles.brand} ${styles.label}`}>
            solERP <span>| 솔리알피</span>
          </div>
          <div className={`${styles.sectionLabel} ${styles.label}`}>프로그램</div>

          <div className={styles.list}>
            {/* 꺼진 프로그램은 레일에 노출하지 않는다 (Sub 는 RLS 가 이미 걸러줌) */}
            {programs.filter((p) => p.enabled).map((p) => {
              const connected = conns.some((c) => c.program.id === p.id)
              return (
                <button
                  type="button"
                  key={p.id}
                  className={`${styles.card} ${connected ? styles.cardActive : ''}`}
                  // 접힘 상태에서는 라벨이 시각적으로 사라지므로 이름을 명시해 둔다
                  aria-label={`${p.name_en} | ${p.name_ko}`}
                  onClick={() => connect(p)}
                >
                  <span className={styles.badge} style={{ background: p.accent_token }}>
                    {p.name_en.slice(0, 2).toUpperCase()}
                  </span>
                  <span className={`${styles.cardText} ${styles.label}`}>
                    <span className={styles.cardNameEn}>{p.name_en}</span>
                    <span className={styles.cardNameKo}>{p.name_ko}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.titleBar}>
          <button type="button" className={styles.hamburger} aria-label="메뉴">
            ☰
          </button>

          {conns.length === 0 ? (
            <div className={styles.noTabs}>열린 탭 없음</div>
          ) : (
            <div className={styles.tabs}>
              {conns.map((c) => (
                <div
                  key={c.id}
                  className={`${styles.tab} ${c.id === activeId ? styles.tabActive : ''}`}
                >
                  <button
                    type="button"
                    className={styles.tabName}
                    onClick={() => setActiveId(c.id)}
                  >
                    {c.program.name_en}
                    <span className={styles.tabKo}>{c.program.name_ko}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.tabClose}
                    aria-label={`${c.program.name_en} 연결 끊기`}
                    onClick={() => setPendingDisconnect(c)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <span className={styles.spacer} />

          <div className={styles.pill}>
            <span className={`${styles.dot} ${conns.length > 0 ? styles.dotOn : ''}`} />
            연결 {conns.length}
          </div>

          {active && (
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={() => setPendingDisconnect(active)}
            >
              연결 끊기
            </button>
          )}

          <div className={styles.userChip}>
            <span>
              {profile.display_name} · {isMaster ? 'Master' : 'Sub'}
            </span>
            <span className={`${styles.avatar} ${isMaster ? '' : styles.avatarSub}`} />
          </div>

          {/* 스펙 25줄 — 로그인하면 환경설정 버튼이 생김 */}
          <button
            type="button"
            className={styles.iconBtn}
            title="환경설정"
            aria-label="환경설정"
            onClick={() => setSettingsOpen(true)}
          >
            ⚙
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            title="로그아웃"
            aria-label="로그아웃"
            onClick={onLogout}
          >
            ⏻
          </button>
        </header>

        <Stage
          conn={active}
          onCancel={() => active && disconnect(active.id)}
          onConnected={markConnected}
        />

        <ActivityBar initial={initialActivity} programs={programs} />
      </div>

      {settingsOpen && (
        <SettingsDialog
          profile={profile}
          programs={programs}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {pendingDisconnect && (
        <DisconnectDialog
          conn={pendingDisconnect}
          onCancel={() => setPendingDisconnect(null)}
          onConfirm={() => {
            disconnect(pendingDisconnect.id)
            setPendingDisconnect(null)
          }}
        />
      )}
    </div>
  )
}
