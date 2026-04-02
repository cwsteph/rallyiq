import { NextRequest, NextResponse } from 'next/server'
import https from 'https'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function get(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }, res => {
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      res.on('error', reject)
    })
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')) })
    req.on('error', reject)
  })
}

function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') }

function inferSurface(t: string): string {
  const s = t.toLowerCase()
  if (['roland garros', 'french open', 'monte carlo', 'madrid', 'rome', 'barcelona',
       'hamburg', 'geneva', 'charleston'].some(k => s.includes(k))) return 'Clay'
  if (['wimbledon', 'halle', 'queens', "queen's", 'eastbourne', 'hertogenbosch',
       'bad homburg'].some(k => s.includes(k))) return 'Grass'
  return 'Hard'
}

const ROUND_MAP: Record<string, string> = {
  'final': 'F', 'semifinal': 'SF', 'quarterfinal': 'QF',
  'round of 16': 'R16', 'round of 32': 'R32', 'round of 64': 'R64', 'round of 128': 'R128',
  'first round': 'R64', 'second round': 'R32', 'third round': 'R16', 'fourth round': 'R16'
}
function normaliseRound(s: string) { return ROUND_MAP[s.toLowerCase()] ?? s.toUpperCase().replace(/\s+/g, '') }

async function fetchESPN(tour: 'atp' | 'wta'): Promise<any[]> {
  const data = JSON.parse(await get(`https://site.api.espn.com/apis/site/v2/sports/tennis/${tour}/scoreboard`))
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + 3)
  const isWTA = tour === 'wta'
  const matches: any[] = []

  for (const event of (data.events ?? [])) {
    const tournament = event.name ?? 'Unknown'
    const surface = inferSurface(tournament)
    const isMasters = /masters|1000/i.test(tournament)

    for (const grouping of (event.groupings ?? [])) {
      for (const comp of (grouping.competitions ?? [])) {
        const status = comp.status?.type?.name
        if (status !== 'STATUS_SCHEDULED' && status !== 'STATUS_IN_PROGRESS') continue
        if ((comp.type?.text ?? '').toLowerCase().includes('double')) continue

        const p1 = comp.competitors?.[0]?.athlete?.displayName ?? comp.competitors?.[0]?.displayName ?? ''
        const p2 = comp.competitors?.[1]?.athlete?.displayName ?? comp.competitors?.[1]?.displayName ?? ''
        if (!p1 || !p2 || p1 === 'TBD' || p2 === 'TBD') continue

        const round = normaliseRound(comp.round?.displayName ?? 'R32')
        const bo = isWTA ? 3 : (round === 'F' || round === 'SF') && isMasters ? 5 : 3
        const matchDate = comp.date ? comp.date.slice(0, 10) : today
        const scheduledTime = comp.date ? new Date(comp.date).toISOString().slice(11, 16) : undefined

        if (matchDate < yesterday) continue
        if (new Date(matchDate) > cutoff) continue

        matches.push({
          match_id: `espn_${comp.id}`,
          tournament,
          surface,
          round,
          best_of: bo,
          match_date: matchDate,
          scheduled_time: scheduledTime ?? null,
          player1_id: slugify(p1),
          player1_name: p1,
          player2_id: slugify(p2),
          player2_name: p2,
          source: `espn-${tour}`
        })
      }
    }
  }
  return matches
}

export async function GET() {
  try {
    const count = await prisma.todayMatch.count()
    const latest = await prisma.todayMatch.findFirst({ orderBy: { fetchedAt: 'desc' } })
    return NextResponse.json({
      ok: true,
      matchCount: count,
      lastUpdated: latest?.fetchedAt?.toISOString() ?? null
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, matchCount: 0, error: e.message })
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.REFRESH_SECRET
  if (secret) {
    try {
      const body = await req.json()
      if (body.secret !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const [atp, wta] = await Promise.all([fetchESPN('atp'), fetchESPN('wta')])
    const seen = new Set<string>()
    const matches = [...atp, ...wta].filter(m => {
      const key = [m.player1_name, m.player2_name].map((n: string) => n.toLowerCase()).sort().join('|')
      if (seen.has(key)) return false
      seen.add(key); return true
    }).sort((a: any, b: any) => (a.scheduled_time ?? '99:99').localeCompare(b.scheduled_time ?? '99:99'))

    // Clear all existing rows then insert fresh batch — no stale data possible
    await prisma.todayMatch.deleteMany()
    await prisma.todayMatch.createMany({
      data: matches.map(m => ({
        match_id:       m.match_id,
        tournament:     m.tournament,
        surface:        m.surface,
        round:          m.round,
        best_of:        m.best_of,
        match_date:     m.match_date,
        scheduled_time: m.scheduled_time ?? null,
        player1_id:     m.player1_id,
        player1_name:   m.player1_name,
        player2_id:     m.player2_id,
        player2_name:   m.player2_name,
        source:         m.source,
      }))
    })

    return NextResponse.json({ ok: true, matchCount: matches.length, refreshedAt: new Date().toISOString() })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
