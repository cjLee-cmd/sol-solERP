'use client'

import { useEffect, useRef } from 'react'
import { SolLogo } from '@/components/SolLogo'
import { childSrc, type Conn } from './useConnections'
import styles from './HubShell.module.css'

/** 와이어프레임 2g — 선택된 프로그램 없음 */
export function IdleStage() {
  return (
    <div className={styles.stage}>
      <SolLogo size={150} logoWidth={93} inset={17} />
      <div className={styles.stageText}>
        <div className={styles.stageTitle}>The soliERP HUB</div>
        <div className={styles.stageHint}>
          <span className={styles.stageDot} />
          <span className={styles.stageDot} />
          <span className={styles.stageDot} />
          <span style={{ marginLeft: 5 }}>왼쪽에서 프로그램을 선택해 연결하세요</span>
        </div>
      </div>
    </div>
  )
}

/** 와이어프레임 2c 상단 — 연결 중 */
function Connecting({ conn, onCancel }: { conn: Conn; onCancel: () => void }) {
  return (
    <div className={styles.stage}>
      <SolLogo size={96} logoWidth={60} inset={11} pace="connecting" />
      <div className={styles.connTitle}>{conn.program.name_en} 연결 중…</div>
      <div className={styles.connUrl}>{conn.program.url} · 세션 발급 대기</div>
      <button type="button" className={styles.ghostBtn} onClick={onCancel}>
        취소
      </button>
    </div>
  )
}

/** 와이어프레임 2a — iframe 임베드 */
function Embedded({ conn, onConnected }: { conn: Conn; onConnected: (id: string) => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null)

  // load 이벤트는 리스너가 붙기 전에 끝나면 놓친다. 마운트 시 한 번 더 확인한다.
  useEffect(() => {
    const el = frameRef.current
    if (el?.contentDocument?.readyState === 'complete') onConnected(conn.id)
  }, [conn.id, onConnected])

  return (
    <div className={styles.surface}>
      <div className={styles.urlBar}>
        {conn.program.url}
        <span className={styles.urlBarRight}>
          {conn.status === 'connected' ? '세션 활성' : '연결 중…'}
        </span>
      </div>
      <iframe
        ref={frameRef}
        className={styles.frame}
        title={`${conn.program.name_en} ${conn.program.name_ko}`}
        src={childSrc(conn.program, conn.id, conn.token)}
        onLoad={() => onConnected(conn.id)}
      />
    </div>
  )
}

/** 와이어프레임 2c 하단 — 새 창 모드로 실행 중 */
function InWindow({ conn }: { conn: Conn }) {
  return (
    <div className={styles.surface}>
      <div className={styles.urlBar}>
        {conn.program.url}
        <span className={styles.urlBarRight}>새 창 · 세션 활성</span>
      </div>
      <div className={styles.windowNote}>
        <div className={styles.windowNoteTitle}>
          {conn.program.name_en} <span>| {conn.program.name_ko}</span>
        </div>
        <div className={styles.windowNoteBody}>
          별도 창에서 실행 중입니다. 연결을 끊으면 해당 창이 닫힙니다.
        </div>
      </div>
    </div>
  )
}

export function Stage({
  conn,
  onCancel,
  onConnected,
}: {
  conn: Conn | null
  onCancel: () => void
  onConnected: (id: string) => void
}) {
  if (!conn) return <IdleStage />

  // iframe 은 로딩 중에도 프레임을 보여준다(그 안에서 로딩이 보이므로).
  // 새 창은 마더 쪽에 보여줄 게 없으니 2c '연결 중' 화면을 띄운다.
  if (conn.status === 'connecting' && conn.program.embed_mode === 'window') {
    return <Connecting conn={conn} onCancel={onCancel} />
  }
  return conn.program.embed_mode === 'iframe' ? (
    <Embedded conn={conn} onConnected={onConnected} />
  ) : (
    <InWindow conn={conn} />
  )
}
