'use client'
// Renders the app chrome (sidebar + topbar) on normal pages, but lets the
// match-detail "The Read" view render full-bleed with its own editorial masthead.
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export function ChromeGate({ sidebar, topbar, children }: {
  sidebar: ReactNode; topbar: ReactNode; children: ReactNode
}) {
  const pathname = usePathname()
  // /matches/<id> → full-bleed. /matches (the list) keeps the chrome.
  const fullBleed = /^\/matches\/[^/]+$/.test(pathname ?? '')

  if (fullBleed) return <div className="min-h-screen">{children}</div>

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebar}
      <div className="flex flex-col flex-1 overflow-hidden">
        {topbar}
        <main className="flex-1 overflow-auto p-4">{children}</main>
      </div>
    </div>
  )
}
