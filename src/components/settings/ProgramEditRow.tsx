'use client'

import { useState, useTransition } from 'react'
import { testConnection, type TestResult } from '@/app/settings/actions'
import type { Program } from '@/lib/types'
import styles from './SettingsDialog.module.css'

export type ProgramDraft = {
  name_en: string
  name_ko: string
  url: string
  embed_mode: 'iframe' | 'window'
}

/** 등록된 프로그램을 그 자리에서 편집하는 폼 (와이어프레임 2d 행 확장) */
export function ProgramEditRow({
  program,
  saving,
  onCancel,
  onSave,
}: {
  program: Program
  saving: boolean
  onCancel: () => void
  onSave: (draft: ProgramDraft) => void
}) {
  const [nameEn, setNameEn] = useState(program.name_en)
  const [nameKo, setNameKo] = useState(program.name_ko)
  const [url, setUrl] = useState(program.url)
  const [mode, setMode] = useState<'iframe' | 'window'>(program.embed_mode)
  const [test, setTest] = useState<TestResult | null>(null)
  const [testing, startTest] = useTransition()

  const onTest = () =>
    startTest(async () => {
      const result = await testConnection(url.trim())
      setTest(result)
      if (result.ok) setMode(result.embedMode)
    })

  const dirty =
    nameEn !== program.name_en ||
    nameKo !== program.name_ko ||
    url !== program.url ||
    mode !== program.embed_mode

  const canSave = nameEn.trim() && nameKo.trim() && url.trim() && dirty && !saving && !testing

  return (
    <div className={styles.editRow}>
      <div className={styles.editHead}>
        <span className={styles.badge} style={{ background: program.accent_token }}>
          {program.name_en.slice(0, 2).toUpperCase()}
        </span>
        <span className={styles.editTitle}>프로그램 편집</span>
      </div>

      <div className={styles.grid2}>
        <div>
          <label className={styles.fieldLabel} htmlFor={`edit-en-${program.id}`}>영문 제목</label>
          <input
            id={`edit-en-${program.id}`}
            className={styles.field}
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
          />
        </div>
        <div>
          <label className={styles.fieldLabel} htmlFor={`edit-ko-${program.id}`}>한글 제목</label>
          <input
            id={`edit-ko-${program.id}`}
            className={styles.field}
            value={nameKo}
            onChange={(e) => setNameKo(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.editUrlRow}>
        <div className={styles.editUrlField}>
          <label className={styles.fieldLabel} htmlFor={`edit-url-${program.id}`}>차일드 링크 (URL)</label>
          <input
            id={`edit-url-${program.id}`}
            className={`${styles.field} ${styles.fieldMono}`}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setTest(null)
            }}
          />
        </div>
        <div className={styles.editModeField}>
          <label className={styles.fieldLabel} htmlFor={`edit-mode-${program.id}`}>실행 모드</label>
          <select
            id={`edit-mode-${program.id}`}
            className={styles.field}
            value={mode}
            onChange={(e) => setMode(e.target.value as 'iframe' | 'window')}
          >
            <option value="window">새 창</option>
            <option value="iframe">iframe</option>
          </select>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnGhost}
          disabled={!url.trim() || testing || saving}
          onClick={onTest}
        >
          {testing ? '확인 중…' : '연결 테스트'}
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={!canSave}
          onClick={() => onSave({ name_en: nameEn.trim(), name_ko: nameKo.trim(), url: url.trim(), embed_mode: mode })}
        >
          저장
        </button>
        <button type="button" className={styles.btnGhost} disabled={saving} onClick={onCancel}>
          취소
        </button>
        <div className={styles.hint}>
          {test ? (
            <span className={test.ok ? styles.hintOk : styles.hintBad}>{test.message}</span>
          ) : (
            '연결 테스트를 돌리면 실행 모드가 자동으로 맞춰집니다.'
          )}
        </div>
      </div>
    </div>
  )
}
