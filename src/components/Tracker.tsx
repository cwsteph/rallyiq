'use client'
// Fires a lightweight visit ping to /api/track on each page view. Fails silently.
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function Tracker({ site = 'rallyiq' }: { site?: string }) {
  const pathname = usePathname()
  useEffect(() => {
    try {
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site, path: pathname, ref: document.referrer }),
        keepalive: true,
      }).catch(() => {})
    } catch {}
  }, [site, pathname])
  return null
}
