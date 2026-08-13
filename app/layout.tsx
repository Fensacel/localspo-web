import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { AppShell } from '@/components/layout/AppShell'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LocalSpo',
  description: 'Stream music, discover artists, and share what you love.',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'LocalSpo',
    description: 'Stream music, discover artists, and share what you love.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="shortcut icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body className={`${inter.className} bg-black text-white antialiased`} suppressHydrationWarning>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
