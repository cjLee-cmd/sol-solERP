import { SolLogo } from '@/components/SolLogo'
import { LoginForm } from './LoginForm'
import styles from './login.module.css'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className={styles.screen}>
      <div className={styles.behind} aria-hidden>
        <SolLogo size={118} logoWidth={73} inset={13} />
        <div className={styles.behindTitle}>The soliERP HUB</div>
      </div>

      <div className={styles.scrim} />

      <LoginForm failed={Boolean(error)} />
    </div>
  )
}
