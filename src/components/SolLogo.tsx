import styles from './SolLogo.module.css'

type Pace = 'idle' | 'connecting'

const PACE: Record<Pace, { spin: string; spinRev: string }> = {
  idle: { spin: '5s', spinRev: '9.5s' },
  connecting: { spin: '1.5s', spinRev: '2.8s' },
}

export function SolLogo({
  size,
  logoWidth,
  inset,
  pace = 'idle',
}: {
  size: number
  logoWidth: number
  inset: number
  pace?: Pace
}) {
  return (
    <div
      className={styles.wrap}
      style={
        {
          '--sol-size': `${size}px`,
          '--sol-logo': `${logoWidth}px`,
          '--sol-inset': `${inset}px`,
          '--sol-spin': PACE[pace].spin,
          '--sol-spin-rev': PACE[pace].spinRev,
        } as React.CSSProperties
      }
    >
      <div className={styles.ringOuter} />
      <div className={styles.ringInner} />
      <div className={styles.mark}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_header2.png" alt="솔리데오" />
        <div className={styles.sheen} />
      </div>
    </div>
  )
}
