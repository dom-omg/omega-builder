import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'ΩBuilder — One sentence. Full product.',
  description: 'Describe your product in one sentence. Get a complete spec, architecture, and production-ready code — instantly.',
  openGraph: {
    title: 'ΩBuilder',
    description: 'One sentence. Full product.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-background text-text antialiased">{children}</body>
    </html>
  )
}
