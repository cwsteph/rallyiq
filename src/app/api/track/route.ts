// src/app/api/track/route.ts
// Visitor logger for the IQ Sports sites. Each site POSTs {site, path, ref};
// this reads the real client IP from the request headers, enriches with a
// best-effort geo lookup, and stores a row in Neon (PageView).
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

function clientIp(req: Request): string | null {
  // Netlify sets x-nf-client-connection-ip; fall back to x-forwarded-for (first hop).
  const nf = req.headers.get('x-nf-client-connection-ip')
  if (nf) return nf.trim()
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip')
}

async function geo(ip: string) {
  // Best-effort, free, no key. Never block the write on it.
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 1500)
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: ctrl.signal, headers: { 'User-Agent': 'IQSports-tracker/1.0' } })
    clearTimeout(t)
    if (!res.ok) return {}
    const d = await res.json()
    return { city: d.city ?? null, region: d.region ?? null, country: d.country_name ?? null, isp: d.org ?? null }
  } catch { return {} }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const site = String(body.site ?? 'unknown').slice(0, 40)
    const path = String(body.path ?? '/').slice(0, 300)
    const referrer = body.ref ? String(body.ref).slice(0, 300) : null
    const userAgent = (req.headers.get('user-agent') ?? '').slice(0, 400) || null
    const ip = clientIp(req)

    // Skip geo for empty / local addresses.
    const enriched = ip && !/^(127\.|::1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) ? await geo(ip) : {}

    await prisma.pageView.create({
      data: { site, path, referrer, userAgent, ip: ip ?? null, ...enriched },
    })
    return new Response(null, { status: 204, headers: CORS })
  } catch {
    // Never surface tracking failures to the visitor.
    return new Response(null, { status: 204, headers: CORS })
  }
}
