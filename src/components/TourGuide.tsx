'use client'
// Single-page guided tour for the RallyIQ dashboard. A client-only overlay engine
// (ported from the PaddockIQ / DugoutIQ walkthrough) styled to the editorial theme.
// Anchors to [data-tour="…"] elements on the board. Auto-fires once on first visit;
// replayable via the masthead "How it works" button (window.startRallyTour).
import { useEffect } from 'react'

interface Step {
  sel: string | null
  title: string
  body: string
  clickhere?: string
  pos?: 'top' | 'bottom' | 'left' | 'right'
  noPulse?: boolean
  maxWidth?: number
}

const KEY = 'rallyiq_tour_seen_v1'

const STEPS: Step[] = [
  {
    sel: '[data-tour="brand"]',
    title: 'Welcome to RallyIQ',
    body: 'RallyIQ is a <b>tennis betting terminal</b> for the ATP &amp; WTA tours. It rates every player, simulates each match, and flags where the model’s win probability beats the bookmaker’s price.<br><br>A 30-second tour of the board. Skip anytime.',
    pos: 'bottom',
    noPulse: true,
  },
  {
    sel: '[data-tour="nav"]',
    title: 'The five desks',
    body: '<b>Dashboard</b> is today’s board. <b>Matches</b> is the full slate. <b>Rankings</b> is every rated player. <b>Bankroll</b> tracks your bets and P&amp;L. <b>Backtest</b> replays the model against history to show how it would have done.',
    pos: 'bottom',
  },
  {
    sel: '[data-tour="refresh"]',
    title: 'Live data',
    body: 'Refresh pulls today’s schedule and re-rates the field. The green dot and count show how many matches are loaded and when they last updated.',
    clickhere: 'Click to fetch today’s slate',
    pos: 'left',
  },
  {
    sel: '[data-tour="metrics"]',
    title: 'The board at a glance',
    body: 'Four numbers: <b>Bankroll</b> (balance + P&amp;L vs. your $100 start), <b>Today’s Edges</b> (matches loaded, with BET / LEAN counts), <b>Win Rate</b> over the last 30 days of settled bets, and <b>Avg Edge</b> — how far the model has beaten the market on the bets you took.',
    pos: 'bottom',
  },
  {
    sel: '[data-tour="top-edges"]',
    title: 'Today’s Top Edges',
    body: 'The five fattest value spots on the slate, ranked by <b>edge</b> — the model’s win probability minus the price’s implied probability. The bigger the gap, the better the bet.',
    pos: 'bottom',
  },
  {
    sel: '[data-tour="edge-card"]',
    title: 'Anatomy of a pick',
    maxWidth: 380,
    body: 'Each card carries the tournament, a <b>surface tag</b> (clay / hard / grass — it shifts the ratings), the matchup, the <b>edge %</b>, and a <b>signal</b>: <b style="color:#3fb96a">BET</b> (strong value), <b style="color:#d6a83a">LEAN</b> (slight), or PASS. The bar is the model’s win-probability split. Click any card for the full match read.',
    clickhere: 'Click a card for the full read',
    pos: 'right',
  },
  {
    sel: '[data-tour="recent-bets"]',
    title: 'Your bet log',
    body: 'Every wager you log shows here with its stake or settled P&amp;L and a win / loss / pending dot. It feeds the win-rate and bankroll numbers up top. Full history lives under <b>Bankroll</b>.',
    pos: 'left',
  },
  {
    sel: null,
    title: 'That’s the board',
    body: 'Set your bankroll, scan the top edges, open any match for the full read, and bet the spots where the model has a real number on the book. <b>Game, set, match. 🎾</b><br><br>Replay anytime from <b>How it works</b> up top.',
    pos: 'bottom',
  },
]

const TOUR_CSS = `
#tut-backdrop{position:fixed;inset:0;background:transparent;z-index:9000;display:none}
#tut-highlight{position:absolute;border:3px solid #d9763f;border-radius:5px;box-shadow:0 0 0 9999px rgba(29,26,21,0.55),0 0 22px rgba(217,118,63,0.5);pointer-events:none;transition:all .22s ease;z-index:9001}
#tut-highlight.pulse{animation:tutPulseR 1.6s ease-in-out infinite}
@keyframes tutPulseR{0%,100%{box-shadow:0 0 0 9999px rgba(29,26,21,0.55),0 0 20px rgba(217,118,63,0.45)}50%{box-shadow:0 0 0 9999px rgba(29,26,21,0.55),0 0 34px rgba(217,118,63,0.9)}}
#tut-tip{position:absolute;max-width:340px;min-width:262px;background:#1d1a15;color:#fffdf8;border:1.5px solid #d9763f;border-radius:7px;padding:16px 18px;z-index:9002;box-shadow:0 14px 34px rgba(29,26,21,0.45);font-family:'Newsreader',Georgia,serif;line-height:1.5;transition:all .2s ease}
#tut-tip .tut-badge{display:inline-block;background:#d9763f;color:#fffdf8;font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;padding:3px 9px;border-radius:3px;margin-bottom:9px}
#tut-tip .tut-title{font-family:'Newsreader',Georgia,serif;font-size:20px;font-weight:600;color:#fffdf8;margin-bottom:6px;line-height:1.1;letter-spacing:-0.3px}
#tut-tip .tut-body{font-family:'Newsreader',Georgia,serif;font-size:14px;color:rgba(255,253,248,0.85);margin-bottom:14px}
#tut-tip .tut-body b{color:#fffdf8;font-weight:600}
#tut-tip .tut-clickhere{display:inline-flex;align-items:center;gap:6px;font-family:'IBM Plex Mono',monospace;font-size:10px;color:#e69a6b;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px}
#tut-tip .tut-clickhere::before{content:"\\1F449";font-size:13px}
#tut-tip .tut-row{display:flex;gap:8px;align-items:center;justify-content:space-between}
#tut-tip .tut-count{font-family:'IBM Plex Mono',monospace;font-size:10px;color:rgba(255,253,248,0.5);letter-spacing:0.06em}
#tut-tip .tut-btns{display:flex;gap:6px}
#tut-tip button{font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;padding:6px 12px;border-radius:3px;cursor:pointer;border:1px solid #d9763f;background:transparent;color:#e69a6b}
#tut-tip button.primary{background:#d9763f;color:#fffdf8;border-color:#d9763f}
#tut-tip button:hover{background:#d9763f;color:#fffdf8}
#tut-tip button:disabled{opacity:.38;cursor:not-allowed}
#tut-tip button:disabled:hover{background:transparent;color:#e69a6b}
#tut-tip .tut-skip{font-family:'IBM Plex Mono',monospace;font-size:10px;color:rgba(255,253,248,0.5);background:none;border:none;padding:4px 6px;text-decoration:underline;cursor:pointer;margin-top:6px;letter-spacing:0;text-transform:none}
#tut-tip .tut-skip:hover{color:rgba(255,253,248,0.82)}
#tut-tip .tut-arrow{position:absolute;width:14px;height:14px;background:#1d1a15;border:1.5px solid #d9763f;transform:rotate(45deg)}
#tut-tip .tut-arrow.top{top:-9px;left:24px;border-right:none;border-bottom:none}
#tut-tip .tut-arrow.bottom{bottom:-9px;left:24px;border-left:none;border-top:none}
#tut-tip .tut-arrow.left{left:-9px;top:24px;border-right:none;border-top:none}
#tut-tip .tut-arrow.right{right:-9px;top:24px;border-left:none;border-bottom:none}
`

export function TourGuide() {
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    let idx = 0
    let active = false

    const findEl = (sel: string | null): HTMLElement | null => {
      if (!sel) return null
      try { return document.querySelector(sel) as HTMLElement | null } catch { return null }
    }

    function ensureDom() {
      if (document.getElementById('tut-backdrop')) return
      const bd = document.createElement('div')
      bd.id = 'tut-backdrop'
      bd.onclick = (e) => { if ((e.target as HTMLElement).id === 'tut-backdrop') skip() }
      document.body.appendChild(bd)
      const hl = document.createElement('div'); hl.id = 'tut-highlight'; document.body.appendChild(hl)
      const tip = document.createElement('div'); tip.id = 'tut-tip'; document.body.appendChild(tip)
    }

    function position() {
      const step = STEPS[idx]
      const target = findEl(step.sel)
      const bd = document.getElementById('tut-backdrop')
      const hl = document.getElementById('tut-highlight')
      const tip = document.getElementById('tut-tip')
      if (!bd || !hl || !tip) return
      bd.style.display = 'block'
      if (!target) {
        hl.style.display = 'none'
        tip.style.position = 'fixed'; tip.style.left = '50%'; tip.style.top = '50%'; tip.style.transform = 'translate(-50%,-50%)'
        return
      }
      const rectInitial = target.getBoundingClientRect()
      const targetCenterY = rectInitial.top + rectInitial.height / 2
      const idealCenter = window.innerHeight / 2
      if (Math.abs(targetCenterY - idealCenter) > 80) {
        document.body.style.overflow = ''
        window.scrollTo(0, rectInitial.top + window.scrollY - idealCenter + rectInitial.height / 2)
        document.body.style.overflow = 'hidden'
      }
      const rect = target.getBoundingClientRect()
      const pad = 6
      hl.style.display = 'block'
      hl.style.left = (rect.left + window.scrollX - pad) + 'px'
      hl.style.top = (rect.top + window.scrollY - pad) + 'px'
      hl.style.width = (rect.width + pad * 2) + 'px'
      hl.style.height = (rect.height + pad * 2) + 'px'
      hl.classList.toggle('pulse', !step.noPulse)
      tip.style.position = 'absolute'; tip.style.transform = ''
      const stepMaxW = step.maxWidth || 340
      tip.style.maxWidth = stepMaxW + 'px'
      const tipW = Math.min(stepMaxW, window.innerWidth - 28)
      const tipH = tip.offsetHeight || 200
      const margin = 14
      let pos: 'top' | 'bottom' | 'left' | 'right' = step.pos || 'bottom'
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const spaceRight = window.innerWidth - rect.right
      const spaceLeft = rect.left
      const fits = (p: string) => {
        if (p === 'bottom') return spaceBelow >= tipH + margin + 8
        if (p === 'top') return spaceAbove >= tipH + margin + 8
        if (p === 'right') return spaceRight >= tipW + margin + 8
        if (p === 'left') return spaceLeft >= tipW + margin + 8
        return false
      }
      if (!fits(pos)) {
        const order = (['top', 'bottom', 'right', 'left'] as const).filter(p => p !== pos)
        for (const p of order) { if (fits(p)) { pos = p; break } }
      }
      let left: number, top: number
      if (pos === 'bottom') { left = rect.left + window.scrollX; top = rect.bottom + window.scrollY + margin }
      else if (pos === 'top') { left = rect.left + window.scrollX; top = rect.top + window.scrollY - tipH - margin }
      else if (pos === 'right') { left = rect.right + window.scrollX + margin; top = rect.top + window.scrollY }
      else { left = rect.left + window.scrollX - tipW - margin; top = rect.top + window.scrollY }
      const arrow = pos === 'top' ? 'bottom' : pos === 'right' ? 'left' : pos === 'left' ? 'right' : 'top'
      const arrowEl = tip.querySelector('.tut-arrow') as HTMLElement | null
      if (arrowEl) arrowEl.className = 'tut-arrow ' + arrow
      const minLeft = window.scrollX + margin
      const maxLeft = window.scrollX + window.innerWidth - tipW - margin
      if (left > maxLeft) left = maxLeft
      if (left < minLeft) left = minLeft
      const minTop = window.scrollY + margin
      const maxTop = window.scrollY + window.innerHeight - tipH - margin
      if (top > maxTop) top = maxTop
      if (top < minTop) top = minTop
      tip.style.left = left + 'px'
      tip.style.top = top + 'px'
    }

    function render() {
      const step = STEPS[idx]
      if (step.sel) {
        const probe = findEl(step.sel)
        const visible = !!probe && (probe.offsetWidth > 0 || probe.offsetHeight > 0 || probe.getClientRects().length > 0)
        if (!visible) {
          if (idx < STEPS.length - 1) { idx++; render(); return }
          finish(); return
        }
      }
      const tip = document.getElementById('tut-tip')
      if (!tip) return
      const arrow = step.pos === 'top' ? 'bottom' : step.pos === 'right' ? 'left' : step.pos === 'left' ? 'right' : 'top'
      const isLast = idx === STEPS.length - 1
      const nextBtn = isLast
        ? '<button class="primary" onclick="window.tutFinish()">Finish ✓</button>'
        : '<button class="primary" onclick="window.tutNext()">Next →</button>'
      tip.innerHTML =
        '<div class="tut-arrow ' + arrow + '"></div>' +
        '<div class="tut-badge">RALLYIQ · STEP ' + (idx + 1) + ' OF ' + STEPS.length + '</div>' +
        '<div class="tut-title">' + step.title + '</div>' +
        '<div class="tut-body">' + step.body + '</div>' +
        (step.clickhere ? '<div class="tut-clickhere">' + step.clickhere + '</div>' : '') +
        '<div class="tut-row">' +
          '<div class="tut-count">' + (idx + 1) + ' / ' + STEPS.length + '</div>' +
          '<div class="tut-btns">' +
            '<button onclick="window.tutPrev()" ' + (idx === 0 ? 'disabled' : '') + '>← Back</button>' +
            nextBtn +
          '</div>' +
        '</div>' +
        '<button class="tut-skip" onclick="window.tutSkip()">Skip tour</button>'
      position()
    }

    function start(force: boolean) {
      try { if (!force && localStorage.getItem(KEY) === '1') return } catch { /* private mode */ }
      ensureDom(); idx = 0; active = true; document.body.style.overflow = 'hidden'; render()
    }
    function next() { if (idx < STEPS.length - 1) { idx++; render() } else finish() }
    function prev() { if (idx > 0) { idx--; render() } }
    function finish() { try { localStorage.setItem(KEY, '1') } catch { /* ignore */ } active = false; teardown() }
    function skip() { finish() }
    function teardown() {
      const bd = document.getElementById('tut-backdrop')
      const hl = document.getElementById('tut-highlight')
      const tip = document.getElementById('tut-tip')
      if (bd) bd.style.display = 'none'
      if (hl) hl.style.display = 'none'
      if (tip) tip.innerHTML = ''
      document.body.style.overflow = ''
    }
    const onResize = () => { if (active) position() }

    w.tutNext = next; w.tutPrev = prev; w.tutSkip = skip; w.tutFinish = finish
    w.startRallyTour = () => start(true)
    window.addEventListener('resize', onResize)

    let timer: ReturnType<typeof setTimeout>
    try {
      if (sessionStorage.getItem('rally_tour_pending') === '1') {
        sessionStorage.removeItem('rally_tour_pending')
        timer = setTimeout(() => start(true), 500)
      } else {
        timer = setTimeout(() => start(false), 800)
      }
    } catch {
      timer = setTimeout(() => start(false), 800)
    }

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', onResize)
      teardown()
      ;['tut-backdrop', 'tut-highlight', 'tut-tip'].forEach(id => {
        const el = document.getElementById(id); if (el) el.remove()
      })
      delete w.tutNext; delete w.tutPrev; delete w.tutSkip; delete w.tutFinish; delete w.startRallyTour
    }
  }, [])

  return <style dangerouslySetInnerHTML={{ __html: TOUR_CSS }} />
}
