'use client'

import { useState } from 'react'
import { login } from './actions'
import styles from './login.module.css'

export function LoginForm({ failed }: { failed: boolean }) {
  const [reveal, setReveal] = useState(false)
  const [password, setPassword] = useState('')

  // 한글 입력 상태에서 영문 글자를 치면 자모가 들어간다(s → ㄴ).
  // 비밀번호는 가려져 있어 눈치채기 어려우므로 미리 알려준다.
  const hasHangul = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(password)

  return (
    <form className={styles.sheet} action={login}>
      <div className={styles.title}>로그인</div>
      <div className={styles.subtitle}>Supabase 계정으로 접속합니다</div>

      <label className={styles.label} htmlFor="email">이메일</label>
      <input
        className={styles.input}
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="name@solideos.com"
      />

      <label className={styles.label} htmlFor="password">비밀번호</label>
      <div className={styles.passwordRow}>
        <input
          className={`${styles.input} ${styles.passwordInput}`}
          id="password"
          name="password"
          type={reveal ? 'text' : 'password'}
          required
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        <button
          type="button"
          className={styles.reveal}
          aria-pressed={reveal}
          aria-label={reveal ? '비밀번호 가리기' : '비밀번호 보기'}
          onClick={() => setReveal((v) => !v)}
        >
          {reveal ? '가리기' : '보기'}
        </button>
      </div>

      {hasHangul && (
        <p className={styles.warn}>
          비밀번호에 한글이 섞여 있습니다. 한/영 키를 눌러 영문으로 바꾼 뒤 다시 입력하세요.
        </p>
      )}

      <button className={styles.submit} type="submit">로그인</button>

      {failed && (
        <p className={styles.error}>
          이메일 또는 비밀번호가 맞지 않습니다. &lsquo;보기&rsquo;를 눌러 입력값을 확인해 보세요.
        </p>
      )}

      <div className={styles.note}>기본 권한 Sub · 승격은 Master가 지정</div>
    </form>
  )
}
