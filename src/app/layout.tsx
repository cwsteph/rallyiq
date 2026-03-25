// src/app/layout.tsx
import type { Metadata } from 'next'
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '700'],
})

const sans = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'RallyIQ — Tennis Betting Terminal',
  description: 'Professional tennis betting analysis and handicapping',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable} ${sans.variable}`}>
      <body className="bg-terminal text-terminal-muted font-sans">
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <TopBar />
            <main className="flex-1 overflow-auto p-4">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  )
}
