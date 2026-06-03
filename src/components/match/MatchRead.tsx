'use client'
// src/components/match/MatchRead.tsx
//
// "The Read" — editorial / broadcast match-detail view for RallyIQ.
// Self-contained: inline styles + tiny inline SVG helpers, no external UI deps.
// Fonts expected (load via next/font or a <link> in layout): Newsreader (serif),
// DM Sans (sans), IBM Plex Mono (mono). Falls back to system fonts otherwise.
//
// Surface drives the accent colour (Clay → terracotta, Hard → blue, Grass → green).
// Interactions: player-perspective tabs flip the dial/split bar; the win-prob
// chart shows a hover readout. Base state is always visible (no opacity-gated
// entrance) so it survives SSR, print and screenshot.

import { useState, useRef } from 'react'
import type { ReadModel } from '@/lib/read/buildReadModel'

const SURFACE: Record<string, { accent: string; glow: string; wash: string }> = {
  Clay: { accent: '#d9763f', glow: 'rgba(217,118,63,0.16)', wash: 'rgba(217,118,63,0.07)' },
  Hard: { accent: '#4a9eff', glow: 'rgba(74,158,255,0.16)', wash: 'rgba(74,158,255,0.07)' },
  Grass: { accent: '#3fb96a', glow: 'rgba(63,185,106,0.16)', wash: 'rgba(63,185,106,0.07)' },
}

const C = {
  bg: '#f3ede2', paper: '#fffdf8', ink: '#1d1a15', body: '#3c3730',
  muted: '#857c6e', faint: '#a89f90', line: '#e6ddcf', line2: '#d8cdb9',
  green: '#1f8a5b', red: '#c0392b', gold: '#b08828',
}
const fmtPct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`
const fmtSignedPct = (x: number, d = 1) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(d)}%`

const serif = { fontFamily: "'Newsreader', Georgia, serif" } as const
const sans = { fontFamily: "'DM Sans', system-ui, sans-serif" } as const
const mono = { fontFamily: "'IBM Plex Mono', monospace" } as const

function FormStrip({ form, win = C.green, loss = C.red }: { form: number[]; win?: string; loss?: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'flex-end' }}>
      {form.map((v, i) => (
        <span key={i} style={{ width: 7, height: v ? 14 : 7, borderRadius: 2, background: v ? win : loss, opacity: v ? 1 : 0.55 }} />
      ))}
    </span>
  )
}

function CourtLines({ w = 244, h = 404, line = C.ink }: { w?: number; h?: number; line?: string }) {
  return (
    <svg viewBox="0 0 120 200" width={w} height={h} style={{ display: 'block' }}>
      <rect x="18" y="18" width="84" height="164" fill="none" stroke={line} strokeWidth="1.6" />
      <line x1="18" y1="100" x2="102" y2="100" stroke={line} strokeWidth="2.4" />
      <rect x="33" y="52" width="54" height="96" fill="none" stroke={line} strokeWidth="1.2" />
      <line x1="60" y1="52" x2="60" y2="148" stroke={line} strokeWidth="1.2" />
    </svg>
  )
}

export default function MatchRead({ model }: { model: ReadModel }) {
  const m = model, p1 = m.p1, p2 = m.p2
  const acc = (SURFACE[m.surface] ?? SURFACE.Hard).accent
  const surf = SURFACE[m.surface] ?? SURFACE.Hard
  const favIdx: 1 | 2 = m.prob1 >= m.prob2 ? 1 : 2
  const [side, setSide] = useState<1 | 2>(m.edge.side)
  const sideP = side === 1 ? p1 : p2
  const sideProb = side === 1 ? m.prob1 : m.prob2
  const sideIsFav = side === favIdx
  const sigCol = m.edge.signal === 'BET' ? C.green : m.edge.signal === 'LEAN' ? C.gold : C.faint

  const eyebrow = { ...mono, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase' as const, color: acc, fontWeight: 600 }
  const kicker = { ...mono, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: C.faint }
  const grow = (w: string) => ({ width: w, transition: 'width .8s cubic-bezier(.2,.7,.2,1)' })
  const card = { background: C.paper, border: `1px solid ${C.line}`, borderRadius: 4, padding: 24 }
  const sec = { ...eyebrow, marginBottom: 14, borderBottom: `1px solid ${C.line2}`, paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }

  function Dial() {
    const R = 58, circ = 2 * Math.PI * R, dash = circ * sideProb
    const col = sideIsFav ? acc : C.muted
    return (
      <div style={{ position: 'relative', width: 152, height: 152 }}>
        <svg viewBox="0 0 152 152" width="152" height="152">
          <circle cx="76" cy="76" r={R} fill="none" stroke={C.line} strokeWidth="11" />
          <circle cx="76" cy="76" r={R} fill="none" stroke={col} strokeWidth="11" strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`} transform="rotate(-90 76 76)" style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(.2,.7,.2,1), stroke .3s' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ ...serif, fontSize: 40, fontWeight: 600, color: C.ink, lineHeight: 1 }}>{(sideProb * 100).toFixed(0)}<span style={{ fontSize: 18 }}>%</span></span>
          <span style={{ ...kicker, marginTop: 3 }}>model win</span>
        </div>
      </div>
    )
  }

  function PlayerCol({ p, idx, align }: { p: ReadModel['p1']; idx: 1 | 2; align: 'left' | 'right' }) {
    const active = side === idx
    return (
      <button onClick={() => setSide(idx)} style={{
        textAlign: align, display: 'flex', flexDirection: 'column', gap: 9,
        alignItems: align === 'right' ? 'flex-end' : 'flex-start', background: 'transparent',
        border: 'none', cursor: 'pointer', padding: 0, width: '100%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, flexDirection: align === 'right' ? 'row-reverse' : 'row' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: active ? acc : C.line2, color: active ? '#fff' : C.body, display: 'flex', alignItems: 'center', justifyContent: 'center', ...serif, fontSize: 24, fontWeight: 600, flexShrink: 0, transition: 'background .25s, color .25s' }}>{p.initials}</div>
          <div style={{ textAlign: align }}>
            <div style={{ ...serif, fontSize: p.name.length > 16 ? 20 : 27, fontWeight: 600, color: C.ink, lineHeight: 1.02, whiteSpace: 'nowrap', borderBottom: active ? `2px solid ${acc}` : '2px solid transparent', paddingBottom: 2, display: 'inline-block', transition: 'border-color .25s' }}>{p.name}</div>
            <div style={{ ...mono, fontSize: 11, color: C.muted, marginTop: 5 }}>{p.country ?? '—'} · {p.rank ? `World #${p.rank}` : 'Unranked'}{p.seed ? ` · [${p.seed}]` : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 2, flexDirection: align === 'right' ? 'row-reverse' : 'row' }}>
          <div style={{ textAlign: align }}><div style={kicker}>Elo</div><div style={{ ...mono, fontSize: 16, color: C.ink, fontWeight: 600 }}>{p.eloOverall}</div></div>
          <div style={{ textAlign: align }}><div style={kicker}>Form</div><div style={{ marginTop: 4 }}><FormStrip form={p.form10} /></div></div>
          {p.ytdWL && <div style={{ textAlign: align }}><div style={kicker}>YTD</div><div style={{ ...mono, fontSize: 16, color: C.ink, fontWeight: 600 }}>{p.ytdWL}</div></div>}
        </div>
      </button>
    )
  }

  function TapeRow({ label, v1, v2, n1, n2, first }: { label: string; v1: React.ReactNode; v2: React.ReactNode; n1: number; n2: number; first?: boolean }) {
    const lead = n1 === n2 ? 0 : n1 > n2 ? 1 : 2
    const share = Math.abs(n1 - n2) / Math.max(Math.abs(n1), Math.abs(n2), 1)
    const mag = Math.min(46, 12 + share * 80)
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 130px 1fr 70px', alignItems: 'center', padding: '11px 0', borderTop: first ? 'none' : `1px solid ${C.line}` }}>
        <span style={{ ...mono, fontSize: 14, fontWeight: 600, color: lead === 1 ? acc : C.ink }}>{v1}</span>
        <div style={{ position: 'relative', height: 8, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ ...grow(lead === 1 ? `${mag}%` : '0%'), height: 8, background: acc, borderRadius: '99px 0 0 99px', opacity: 0.85 }} />
        </div>
        <span style={{ ...kicker, textAlign: 'center' }}>{label}</span>
        <div style={{ position: 'relative', height: 8 }}>
          <div style={{ ...grow(lead === 2 ? `${mag}%` : '0%'), height: 8, background: C.ink, borderRadius: '0 99px 99px 0', opacity: 0.7 }} />
        </div>
        <span style={{ ...mono, fontSize: 14, fontWeight: 600, color: lead === 2 ? acc : C.ink, textAlign: 'right' }}>{v2}</span>
      </div>
    )
  }

  function WinProbChart() {
    const data = m.momentum
    const [hi, setHi] = useState<number | null>(null)
    const wrap = useRef<HTMLDivElement>(null)
    const W = 640, H = 190, pad = 10, n = data.length
    const X = (i: number) => pad + (i / (n - 1)) * (W - 2 * pad)
    const Y = (v: number) => pad + (1 - v / 100) * (H - 2 * pad)
    const pts = data.map((d, i) => [X(i), Y(d.p1)] as const)
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
    const area = `${line} L ${X(n - 1)} ${H - pad} L ${X(0)} ${H - pad} Z`
    const last = data[data.length - 1].p1
    const cur = hi != null ? data[hi] : null
    function onMove(e: React.MouseEvent) {
      const r = wrap.current!.getBoundingClientRect()
      const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1))
      setHi(Math.max(0, Math.min(n - 1, i)))
    }
    return (
      <div ref={wrap} onMouseMove={onMove} onMouseLeave={() => setHi(null)} style={{ position: 'relative', cursor: 'crosshair' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ display: 'block', height: 190 }}>
          <defs>
            <linearGradient id="rq-edwin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={acc} stopOpacity="0.22" />
              <stop offset="100%" stopColor={acc} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1={pad} y1={Y(50)} x2={W - pad} y2={Y(50)} stroke={C.line2} strokeWidth="1" strokeDasharray="2 4" />
          <text x={pad + 2} y={Y(50) - 4} style={mono} fontSize="9" fill={C.faint}>even</text>
          <path d={area} fill="url(#rq-edwin)" />
          <path d={line} fill="none" stroke={acc} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {cur && <line x1={X(hi!)} y1={pad} x2={X(hi!)} y2={H - pad} stroke={C.muted} strokeWidth="1" />}
          {cur && <circle cx={X(hi!)} cy={Y(cur.p1)} r="4.5" fill={acc} stroke={C.paper} strokeWidth="2" />}
          <circle cx={X(n - 1)} cy={Y(last)} r="4" fill={acc} />
        </svg>
        {cur && (
          <div style={{ position: 'absolute', left: `${(X(hi!) / W) * 100}%`, top: -6, transform: 'translateX(-50%)', background: C.ink, color: C.paper, ...mono, fontSize: 10, padding: '4px 8px', borderRadius: 3, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            {cur.label} · {p1.last} {cur.p1}%
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          {data.filter((_, i) => i % 3 === 0).map((d, i) => <span key={i} style={{ ...mono, fontSize: 9, color: C.faint }}>{d.label}</span>)}
        </div>
      </div>
    )
  }

  const tape: [string, React.ReactNode, React.ReactNode, number, number][] = [
    ['Elo · Overall', p1.eloOverall, p2.eloOverall, p1.eloOverall, p2.eloOverall],
    [`Elo · ${m.surface}`, p1.eloSurface, p2.eloSurface, p1.eloSurface, p2.eloSurface],
    ['Hold %', fmtPct(p1.holdPct), fmtPct(p2.holdPct), p1.holdPct, p2.holdPct],
    ['Break %', fmtPct(p1.breakPct), fmtPct(p2.breakPct), p1.breakPct, p2.breakPct],
    ['Form L10', `${p1.formScore}/10`, `${p2.formScore}/10`, p1.formScore, p2.formScore],
  ]
  const isPass = m.edge.signal === 'PASS'

  return (
    <div style={{ ...sans, background: C.bg, color: C.body, width: '100%', minHeight: '100%' }}>
      {/* masthead */}
      <div style={{ borderBottom: `2px solid ${C.ink}`, background: C.paper }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 28px', height: 56, display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ ...serif, fontWeight: 700, fontSize: 24, color: C.ink, letterSpacing: -0.5 }}>Rally<span style={{ color: acc }}>IQ</span></span>
          <div style={{ display: 'flex', gap: 20, marginLeft: 8 }}>
            {['Dashboard', 'Matches', 'Rankings', 'Bankroll', 'Backtest'].map((n, i) => (
              <span key={n} style={{ ...mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: i === 1 ? C.ink : C.faint, fontWeight: i === 1 ? 700 : 400, borderBottom: i === 1 ? `2px solid ${acc}` : 'none', paddingBottom: 2 }}>{n}</span>
            ))}
          </div>
          <span style={{ ...mono, fontSize: 10, color: C.faint, marginLeft: 'auto' }}>{m.dateLong}</span>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 28px 44px' }}>
        {/* COVER HERO */}
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 6, border: `1px solid ${C.line2}`, background: `linear-gradient(135deg, ${C.paper}, ${C.bg})`, padding: '30px 32px 28px', marginBottom: 14 }}>
          <div style={{ position: 'absolute', right: -16, top: -34, opacity: 0.16, pointerEvents: 'none' }}><CourtLines /></div>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: acc }} />
          <div style={{ position: 'absolute', right: 28, top: 26, transform: 'rotate(7deg)', textAlign: 'center', border: `3px solid ${sigCol}`, borderRadius: 4, padding: '8px 16px 6px', background: 'rgba(255,253,248,0.6)' }}>
            <div style={{ ...kicker, color: sigCol, opacity: 0.85, marginBottom: 1 }}>Model Verdict</div>
            <div style={{ ...mono, fontSize: 30, fontWeight: 700, color: sigCol, letterSpacing: 3, lineHeight: 1 }}>{m.edge.signal}</div>
            <div style={{ ...mono, fontSize: 11, color: sigCol, fontWeight: 600, marginTop: 3 }}>{m.thesis.tag}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ ...mono, fontSize: 10, color: C.faint }}>← Match Center</span>
            <span style={{ width: 1, height: 12, background: C.line2 }} />
            <span style={eyebrow}>{m.tournament} · {m.surface} · {m.round} · BO{m.bestOf}</span>
          </div>
          <h1 style={{ ...serif, fontSize: 50, fontWeight: 600, color: C.ink, lineHeight: 1.02, letterSpacing: -0.8, margin: '0 0 14px', maxWidth: 760, textWrap: 'balance' }}>{m.thesis.headline}</h1>
          <p style={{ ...serif, fontSize: 20, fontStyle: 'italic', color: C.body, lineHeight: 1.45, maxWidth: 660, margin: 0 }}>{m.thesis.body.split('. ')[0]}.</p>
          <div style={{ ...mono, fontSize: 10, color: C.faint, marginTop: 24, letterSpacing: 0.5 }}>BY THE RALLYIQ MODEL · ELO + FORM + {Math.round(m.sim.iterations / 1000)}K SIMS{m.court ? ` · ${m.court}` : ''}{m.timeLocal ? `, ${m.timeLocal}` : ''}</div>
        </div>

        {/* MATCHUP CARD */}
        <div style={{ ...card, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <div style={{ display: 'inline-flex', border: `1px solid ${C.line2}`, borderRadius: 99, overflow: 'hidden' }}>
              {([1, 2] as const).map(idx => (
                <button key={idx} onClick={() => setSide(idx)} style={{ ...mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', padding: '6px 16px', cursor: 'pointer', border: 'none', background: side === idx ? acc : 'transparent', color: side === idx ? '#fff' : C.muted, transition: 'all .2s', fontWeight: 600 }}>
                  {(idx === 1 ? p1 : p2).last}’s read
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 24, alignItems: 'center' }}>
            <PlayerCol p={p1} idx={1} align="left" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Dial />
              <div style={{ ...mono, fontSize: 11, color: C.muted, textAlign: 'center' }}>{sideP.last} {sideIsFav ? 'favored' : 'underdog'}</div>
            </div>
            <PlayerCol p={p2} idx={2} align="right" />
          </div>
          <div style={{ marginTop: 22, display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', background: C.line }}>
            <div style={{ ...grow(`${m.prob1 * 100}%`), background: side === 1 ? acc : C.line2 }} />
            <div style={{ flex: 1, background: side === 2 ? acc : C.line2 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }}>
            <span style={{ ...mono, fontSize: 12, color: side === 1 ? acc : C.muted, fontWeight: 600 }}>{p1.last} {fmtPct(m.prob1)}</span>
            <span style={{ ...mono, fontSize: 12, color: side === 2 ? acc : C.muted, fontWeight: 600 }}>{p2.last} {fmtPct(m.prob2)}</span>
          </div>
        </div>

        {/* BODY */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 28 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            <div>
              <div style={sec}>The Case</div>
              <p style={{ ...serif, fontSize: 17.5, color: C.body, lineHeight: 1.7, margin: 0 }}>
                <span style={{ ...serif, fontSize: 52, fontWeight: 700, color: acc, float: 'left', lineHeight: 0.74, paddingRight: 10, paddingTop: 5 }}>{m.thesis.body[0]}</span>
                {m.thesis.body.slice(1)}
              </p>
              <blockquote style={{ margin: '22px 0 4px', padding: '4px 0 4px 20px', borderLeft: `3px solid ${acc}` }}>
                <p style={{ ...serif, fontSize: 23, fontStyle: 'italic', fontWeight: 500, color: C.ink, lineHeight: 1.35, margin: 0, textWrap: 'balance' }}>“{m.thesis.pullQuote}”</p>
              </blockquote>
            </div>

            <div>
              <div style={sec}>What Moves the Number</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {m.factors.map((f, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '170px 1fr 92px', gap: 14, alignItems: 'center' }}>
                    <span style={{ ...mono, fontSize: 11.5, color: C.body }}>{f.key}</span>
                    <div style={{ position: 'relative', height: 8, background: C.line, borderRadius: 99 }}>
                      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: C.line2 }} />
                      <div style={{ position: 'absolute', top: 0, bottom: 0, borderRadius: 99, background: f.favors === 2 ? C.ink : acc, opacity: f.favors === 2 ? 0.7 : 0.85, ...(f.favors === 1 ? { right: '50%' } : { left: '50%' }), ...grow(f.favors === 0 ? '0%' : `${Math.round(f.mag * 50)}%`) }} />
                    </div>
                    <span style={{ ...mono, fontSize: 10, textAlign: 'right', color: f.favors === 0 ? C.faint : acc, fontWeight: 600 }}>{f.favors === 0 ? 'EVEN' : (f.favors === 1 ? p1.last : p2.last)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={sec}>Tale of the Tape</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ ...mono, fontSize: 11, color: acc, fontWeight: 700 }}>{p1.last}</span>
                <span style={{ ...mono, fontSize: 11, color: C.ink, fontWeight: 700 }}>{p2.last}</span>
              </div>
              {tape.map((r, i) => <TapeRow key={i} label={r[0]} v1={r[1]} v2={r[2]} n1={r[3]} n2={r[4]} first={i === 0} />)}
            </div>

            <div>
              <div style={sec}>Head to Head</div>
              {m.h2h.meetings === 0 ? (
                <div style={{ ...serif, fontSize: 18, color: C.muted, fontStyle: 'italic', padding: '4px 0' }}>{m.h2h.note} — no prior data to lean on.</div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12 }}>
                    <span style={{ ...serif, fontSize: 44, fontWeight: 700, color: acc }}>{m.h2h.p1Wins}</span>
                    <span style={{ ...mono, fontSize: 11, color: C.faint, textTransform: 'uppercase', letterSpacing: 2 }}>{m.h2h.note}</span>
                    <span style={{ ...serif, fontSize: 44, fontWeight: 700, color: C.ink, marginLeft: 'auto' }}>{m.h2h.p2Wins}</span>
                  </div>
                  {m.h2h.recent.map((r, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center', padding: '9px 0', borderTop: `1px solid ${C.line}` }}>
                      <span style={{ ...mono, fontSize: 12, color: r.winner === 1 ? acc : C.faint, fontWeight: r.winner === 1 ? 700 : 400 }}>{r.winner === 1 ? p1.last : p2.last}</span>
                      <span style={{ ...mono, fontSize: 11, color: C.muted, textAlign: 'center' }}>{r.event} ’{String(r.year).slice(2)} · {r.surface}</span>
                      <span style={{ ...mono, fontSize: 12, color: C.body, textAlign: 'right' }}>{r.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div style={sec}>
                Win Probability · Live Track
                <span style={{ marginLeft: 'auto', ...mono, fontSize: 9, color: C.green, display: 'flex', alignItems: 'center', gap: 5, letterSpacing: 1 }}><span style={{ width: 6, height: 6, borderRadius: 99, background: C.green }} />LIVE</span>
              </div>
              <div style={{ ...card, padding: '18px 18px 12px' }}>
                <WinProbChart />
                <div style={{ ...mono, fontSize: 9, color: C.faint, marginTop: 6, textAlign: 'right' }}>hover the line · {p1.last} win probability through the match</div>
              </div>
            </div>
          </div>

          {/* sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ background: isPass ? C.paper : acc, color: isPass ? C.body : '#fff', border: `1px solid ${isPass ? C.line2 : acc}`, borderRadius: 4, padding: 22, position: 'sticky', top: 16 }}>
              <div style={{ ...mono, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: isPass ? acc : 'rgba(255,255,255,0.85)', fontWeight: 600, marginBottom: 12 }}>The Play</div>
              {isPass ? (
                <div>
                  <div style={{ ...serif, fontSize: 30, fontWeight: 600, color: C.ink, marginBottom: 8 }}>No bet.</div>
                  <p style={{ ...sans, fontSize: 14, color: C.muted, lineHeight: 1.55, margin: 0 }}>{m.thesis.line}. A {fmtSignedPct(m.edge.value1, 2)} edge doesn’t clear the 2% threshold. Sit this one out.</p>
                </div>
              ) : (
                <div>
                  <div style={{ ...serif, fontSize: 28, fontWeight: 700, lineHeight: 1.05, marginBottom: 4 }}>{m.thesis.pickName}</div>
                  <div style={{ ...mono, fontSize: 13, opacity: 0.92, marginBottom: 16 }}>Moneyline · {m.market.marketAmerican2} ({m.market.marketOdds2})</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'rgba(255,255,255,0.28)', borderRadius: 3, overflow: 'hidden' }}>
                    {[['Edge', m.thesis.tag], ['Stake', `$${m.edge.suggestedStake.toFixed(2)}`], ['To win', `$${(m.edge.suggestedStake * (m.market.marketOdds2 - 1)).toFixed(2)}`], ['Kelly', `${(m.edge.kellyFraction * 100).toFixed(1)}%`]].map(([l, v]) => (
                      <div key={l} style={{ background: acc, padding: '10px 12px' }}>
                        <div style={{ ...mono, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.8 }}>{l}</div>
                        <div style={{ ...mono, fontSize: 16, fontWeight: 600 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <button style={{ width: '100%', marginTop: 14, padding: '12px', background: '#fff', color: acc, ...mono, fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', border: 'none', borderRadius: 3, cursor: 'pointer' }}>Add to Bet Slip</button>
                </div>
              )}
            </div>

            <div style={card}>
              <div style={{ ...eyebrow, marginBottom: 14 }}>The Line</div>
              {([[p1, m.market.fairOdds1, m.market.marketOdds1, m.market.marketAmerican1, m.edge.value1], [p2, m.market.fairOdds2, m.market.marketOdds2, m.market.marketAmerican2, m.edge.value2]] as const).map(([p, fair, mkt, am, ed], i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: i ? `1px solid ${C.line}` : 'none' }}>
                  <div>
                    <div style={{ ...serif, fontSize: 17, fontWeight: 600, color: C.ink }}>{p.last}</div>
                    <div style={{ ...mono, fontSize: 10, color: C.faint }}>fair {fair}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ ...mono, fontSize: 15, fontWeight: 600, color: C.ink }}>{mkt} <span style={{ color: C.muted, fontSize: 11 }}>({am})</span></div>
                    <div style={{ ...mono, fontSize: 11, fontWeight: 600, color: ed >= 0.05 ? C.green : ed >= 0.02 ? C.gold : C.faint }}>{fmtSignedPct(ed, 1)} edge</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={card}>
              <div style={{ ...eyebrow, marginBottom: 14 }}>Simulation · {Math.round(m.sim.iterations / 1000)}k</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                {[['Sim Win', fmtPct(m.sim.winProb1)], ['Avg Games', String(m.sim.avgGames)], ['O 21.5', fmtPct(m.sim.over21Pct)]].map(([l, v]) => (
                  <div key={l} style={{ textAlign: 'center' }}><div style={{ ...serif, fontSize: 26, fontWeight: 600, color: C.ink }}>{v}</div><div style={kicker}>{l}</div></div>
                ))}
              </div>
              {Object.entries(m.sim.distribution).map(([b, pct]) => (
                <div key={b} style={{ display: 'grid', gridTemplateColumns: '46px 1fr 30px', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ ...mono, fontSize: 10, color: C.faint }}>{b}</span>
                  <div style={{ height: 8, background: C.line, borderRadius: 99 }}><div style={{ height: '100%', ...grow(`${(pct / 0.25) * 60}%`), maxWidth: '100%', background: acc, opacity: 0.45 + pct, borderRadius: 99 }} /></div>
                  <span style={{ ...mono, fontSize: 10, color: C.faint, textAlign: 'right' }}>{(pct * 100).toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
