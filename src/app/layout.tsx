import type { Metadata } from 'next'
import '@/styles/tokens.css'

export const metadata: Metadata = {
  title: 'solERP | 솔리알피',
  description: 'The soliERP HUB — 마더 프로그램',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
