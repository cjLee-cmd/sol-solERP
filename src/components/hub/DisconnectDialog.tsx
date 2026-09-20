'use client'

import { useEffect, useRef } from 'react'
import type { Conn } from './useConnections'
import styles from './HubShell.module.css'

/** 와이어프레임 2e — 연결 끊기 확인 얼럿 */
export function DisconnectDialog({
  conn,
  onCancel,
  onConfirm,
}: {
  conn: Conn
  onCancel: () => void
  onConfirm: () => void
}) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <div
        className={styles.alert}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="disconnect-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.alertTitle} id="disconnect-title">
          {conn.program.name_en} 연결을 끊을까요?
        </div>
        <div className={styles.alertBody}>
          연결을 끊으면 차일드 프로그램 프로세스가 종료됩니다. 저장하지 않은 작업은 사라질 수
          있습니다.
        </div>
        <div className={styles.alertActions}>
          <button type="button" className={styles.alertCancel} onClick={onCancel}>
            취소
          </button>
          <button type="button" className={styles.alertConfirm} ref={confirmRef} onClick={onConfirm}>
            연결 끊기
          </button>
        </div>
      </div>
    </div>
  )
}
