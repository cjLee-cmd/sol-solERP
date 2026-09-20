'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addProgram,
  deleteProgram,
  setProgramEnabled,
  swapProgramOrder,
  testConnection,
  updateProgram,
  type TestResult,
} from '@/app/settings/actions'
import type { Profile, Program } from '@/lib/types'
import { ProgramEditRow } from './ProgramEditRow'
import styles from './SettingsDialog.module.css'

// 스펙 25줄 — "환경설정 내용은 추후 추가". 지금 실제로 동작하는 건 '프로그램 연결' 탭이고
// 나머지는 자리만 잡아둡니다.
const MASTER_TABS = ['일반', '계정 · 권한', '프로그램 연결', '알림', '데이터 · 배포'] as const
const SUB_TABS = ['일반'] as const

export function SettingsDialog({
  profile,
  programs,
  onClose,
}: {
  profile: Profile
  programs: Program[]
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const isMaster = profile.role === 'master'
  const tabs = isMaster ? MASTER_TABS : SUB_TABS
  const [tab, setTab] = useState<string>(isMaster ? '프로그램 연결' : '일반')

  const [nameEn, setNameEn] = useState('')
  const [nameKo, setNameKo] = useState('')
  const [url, setUrl] = useState('')
  const [test, setTest] = useState<TestResult | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const { error } = await fn()
      if (error) {
        console.error('[solERP] 환경설정', error)
        return
      }
      router.refresh()
    })

  const onTest = () =>
    startTransition(async () => {
      setTest(await testConnection(url))
    })

  const onAdd = () =>
    run(async () => {
      const result = await addProgram({
        name_en: nameEn.trim(),
        name_ko: nameKo.trim(),
        url: url.trim(),
        embed_mode: test?.embedMode ?? 'iframe',
      })
      if (!result.error) {
        setNameEn('')
        setNameKo('')
        setUrl('')
        setTest(null)
      }
      return result
    })

  const canAdd = nameEn.trim() && nameKo.trim() && url.trim() && !pending

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <div className={styles.headTitle} id="settings-title">
            환경설정
          </div>
          <button type="button" className={styles.close} aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.body}>
          <nav className={styles.nav}>
            {tabs.map((t) => (
              <button
                type="button"
                key={t}
                className={`${styles.navItem} ${t === tab ? styles.navItemActive : ''}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </nav>

          <div className={styles.content}>
            {tab === '프로그램 연결' && isMaster ? (
              <>
                <div className={styles.sectionHead}>
                  <div className={styles.sectionTitle}>등록된 차일드 프로그램</div>
                  <div className={styles.sectionNote}>
                    Master만 편집 가능 · 전체 {programs.length}개
                  </div>
                </div>

                <div className={styles.list}>
                  {programs.map((p, i) =>
                    editingId === p.id ? (
                      <ProgramEditRow
                        key={p.id}
                        program={p}
                        saving={pending}
                        onCancel={() => setEditingId(null)}
                        onSave={(draft) =>
                          run(async () => {
                            const result = await updateProgram(p.id, draft)
                            if (!result.error) setEditingId(null)
                            return result
                          })
                        }
                      />
                    ) : (
                    <div
                      key={p.id}
                      className={`${styles.row} ${p.enabled ? '' : styles.rowOff}`}
                    >
                      <span className={styles.badge} style={{ background: p.accent_token }}>
                        {p.name_en.slice(0, 2).toUpperCase()}
                      </span>
                      <div className={styles.names}>
                        <div className={styles.nameEn}>{p.name_en}</div>
                        <div className={styles.nameKo}>{p.name_ko}</div>
                      </div>
                      <div className={styles.url} title={p.url}>
                        {p.url}
                      </div>
                      <span className={styles.mode}>
                        {p.embed_mode === 'iframe' ? 'iframe' : '새 창'}
                      </span>
                      <button
                        type="button"
                        className={styles.toggle}
                        aria-pressed={p.enabled}
                        aria-label={`${p.name_en} ${p.enabled ? '끄기' : '켜기'}`}
                        disabled={pending}
                        onClick={() => run(() => setProgramEnabled(p.id, !p.enabled))}
                      >
                        <span className={styles.knob} />
                      </button>
                      <button
                        type="button"
                        className={styles.rowBtn}
                        aria-label={`${p.name_en} 편집`}
                        disabled={pending}
                        onClick={() => setEditingId(p.id)}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className={styles.rowBtn}
                        aria-label={`${p.name_en} 위로`}
                        disabled={pending || i === 0}
                        onClick={() => run(() => swapProgramOrder(p.id, programs[i - 1].id))}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={styles.rowBtn}
                        aria-label={`${p.name_en} 아래로`}
                        disabled={pending || i === programs.length - 1}
                        onClick={() => run(() => swapProgramOrder(p.id, programs[i + 1].id))}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className={`${styles.rowBtn} ${styles.rowBtnDanger}`}
                        aria-label={`${p.name_en} 삭제`}
                        disabled={pending}
                        onClick={() => run(() => deleteProgram(p.id))}
                      >
                        ✕
                      </button>
                    </div>
                    )
                  )}
                </div>

                <div className={styles.addBlock}>
                  <div className={styles.addTitle}>새 프로그램 추가</div>
                  <div className={styles.grid2}>
                    <div>
                      <label className={styles.fieldLabel} htmlFor="name-en">영문 제목</label>
                      <input
                        id="name-en"
                        className={styles.field}
                        value={nameEn}
                        onChange={(e) => setNameEn(e.target.value)}
                        placeholder="TRAVEL"
                      />
                    </div>
                    <div>
                      <label className={styles.fieldLabel} htmlFor="name-ko">한글 제목</label>
                      <input
                        id="name-ko"
                        className={styles.field}
                        value={nameKo}
                        onChange={(e) => setNameKo(e.target.value)}
                        placeholder="KTX 자동예약"
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: 11 }}>
                    <label className={styles.fieldLabel} htmlFor="child-url">차일드 링크 (URL)</label>
                    <input
                      id="child-url"
                      className={`${styles.field} ${styles.fieldMono}`}
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value)
                        setTest(null)
                      }}
                      placeholder="https://travel.solideo.app"
                    />
                  </div>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      disabled={!url.trim() || pending}
                      onClick={onTest}
                    >
                      연결 테스트
                    </button>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      disabled={!canAdd}
                      onClick={onAdd}
                    >
                      ＋ 추가
                    </button>
                    <div className={styles.hint}>
                      {test ? (
                        <span className={test.ok ? styles.hintOk : styles.hintBad}>
                          {test.message}
                        </span>
                      ) : (
                        "연결 테스트는 iframe 임베드 허용 여부(frame-ancestors)를 확인하고, 불가하면 '새 창' 모드로 등록합니다."
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.placeholder}>
                <div className={styles.sectionTitle}>{tab}</div>
                {tab === '일반' && !isMaster ? (
                  <p>
                    {profile.display_name} · Sub 권한입니다. 개인 설정만 열람할 수 있고, 프로그램
                    등록·권한 지정은 Master가 합니다.
                  </p>
                ) : (
                  <p>추후 추가 예정입니다.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
