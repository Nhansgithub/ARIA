import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ARIA',
  description: 'AI Business Consultant',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}
