// src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
import { Masthead } from '@/components/editorial/Masthead'
import { Tracker } from '@/components/Tracker'
import { C } from '@/lib/editorial/theme'

export const metadata: Metadata = {
  title: 'RallyIQ — Tennis Betting Terminal',
  description: 'Professional tennis betting analysis and handicapping',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Editorial theme fonts (referenced by family name across the app). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;0,6..72,700;1,6..72,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ background: C.bg, color: C.body, fontFamily: "'DM Sans', system-ui, sans-serif", margin: 0, minHeight: '100vh' }}>
        <Tracker site="rallyiq" />
        <Masthead />
        <main>{children}</main>
      </body>
    </html>
  )
}
