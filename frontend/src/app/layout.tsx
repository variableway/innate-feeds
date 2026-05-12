import type { Metadata } from 'next'
import { AppLayout } from '@/components/layout/app-layout'
import './globals.css'

export const metadata: Metadata = {
  title: 'GitHub Starred Repositories Viewer',
  description: 'View and filter GitHub starred repositories',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  )
}
