// src/app/admin/visits/page.tsx — gated visitor log viewer.
import { prisma } from '@/lib/db'
import { Container, Card, SectionLabel, C, mono, serif } from '@/components/editorial/ui'

export const dynamic = 'force-dynamic'

const ADMIN_KEY = process.env.ADMIN_KEY ?? 'rallyiq2026'

const SITE_ACCENT: Record<string, string> = {
  rallyiq: '#d9763f', paddockiq: '#1f8a5b', dugoutiq: '#1f4e79', landing: '#1d1a15',
}

function device(ua?: string | null) {
  if (!ua) return '—'
  if (/iphone|android.*mobile|mobile/i.test(ua)) return 'Mobile'
  if (/ipad|tablet/i.test(ua)) return 'Tablet'
  const b = /edg/i.test(ua) ? 'Edge' : /chrome/i.test(ua) ? 'Chrome' : /firefox/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'Desktop'
  return b
}

export default async function VisitsPage({ searchParams }: { searchParams: { key?: string } }) {
  if (searchParams.key !== ADMIN_KEY) {
    return (
      <Container>
        <div style={{ ...mono, fontSize: 12, color: C.faint, padding: '48px 0' }}>
          Unauthorized — append <span style={{ color: C.ink }}>?key=…</span> to view.
        </div>
      </Container>
    )
  }

  const views = await prisma.pageView.findMany({ orderBy: { createdAt: 'desc' }, take: 300 })
  const total = await prisma.pageView.count()
  const uniqueIps = new Set(views.map(v => v.ip).filter(Boolean)).size

  const th = { ...mono, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' as const, color: C.faint, textAlign: 'left' as const, padding: '8px 10px', borderBottom: `1px solid ${C.line2}` }
  const td = { ...mono, fontSize: 11, color: C.body, padding: '7px 10px', borderBottom: `1px solid ${C.line}`, whiteSpace: 'nowrap' as const }

  return (
    <Container>
      <div style={{ marginBottom: 20 }}>
        <div style={{ ...mono, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: C.faint }}>IQ Sports · Admin</div>
        <h1 style={{ ...serif, fontSize: 36, fontWeight: 600, color: C.ink, letterSpacing: -0.5, margin: '4px 0 0' }}>Visitor log</h1>
        <div style={{ ...mono, fontSize: 11, color: C.muted, marginTop: 6 }}>{total} total views · {uniqueIps} unique IPs in last {views.length}</div>
      </div>

      <Card style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              {['When', 'Site', 'Path', 'IP', 'Location', 'ISP', 'Device', 'Referrer'].map(h => <th key={h} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {views.map(v => (
              <tr key={v.id}>
                <td style={td}>{new Date(v.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                <td style={{ ...td, color: SITE_ACCENT[v.site] ?? C.ink, fontWeight: 600 }}>{v.site}</td>
                <td style={td}>{v.path}</td>
                <td style={{ ...td, color: C.ink }}>{v.ip ?? '—'}</td>
                <td style={td}>{[v.city, v.region, v.country].filter(Boolean).join(', ') || '—'}</td>
                <td style={{ ...td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.isp ?? '—'}</td>
                <td style={td}>{device(v.userAgent)}</td>
                <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.referrer || 'direct'}</td>
              </tr>
            ))}
            {views.length === 0 && (
              <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: C.faint, padding: '32px' }}>No visits logged yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </Container>
  )
}
