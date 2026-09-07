'use client'
// src/components/editorial/SearchPalette.tsx
//
// One searcher for both tournaments and players. Two inputs would double the
// chrome in a masthead row that has none to spare, and someone typing "sinner"
// or "cincinnati" should not have to pre-classify what they mean.
//
// Hand-rolled rather than Radix. @radix-ui/react-dialog is in package.json and
// imported by nothing; adopting it here would introduce the first className in
// src/ (there is exactly one, imperative, in TourGuide), a cn() helper, and a
// dependency on Tailwind, which is currently dead weight with a stale dark
// palette that layout.tsx overrides inline. Radix ships this unstyled anyway,
// so it would buy a focus trap and a portal for about sixty lines of work.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { C, BRAND, serif, mono } from '@/lib/editorial/theme'

interface TournamentHit {
  slug: string
  name: string
  surface: string | null
  tours: string[]
  start: string
  end: string
  matches: number
}
interface PlayerHit {
  id: string
  name: string
  tour: string
  rank: number | null
  elo: number
}

type Row =
  | { kind: 'tournament'; key: string; href: string; hit: TournamentHit }
  | { kind: 'player'; key: string; href: string; hit: PlayerHit }

const DEBOUNCE_MS = 180

export function SearchPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [tournaments, setTournaments] = useState<TournamentHit[]>([])
  const [players, setPlayers] = useState<PlayerHit[]>([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Monotonic guard: a slow response for "sin" must not overwrite a fast one
  // for "sinner". Neither the debounce nor the abort covers that on its own.
  const seqRef = useRef(0)

  const rows: Row[] = useMemo(
    () => [
      ...tournaments.map(t => ({ kind: 'tournament' as const, key: `t:${t.slug}`, href: `/tournaments/${t.slug}`, hit: t })),
      ...players.map(p => ({ kind: 'player' as const, key: `p:${p.id}`, href: `/players/${p.id}`, hit: p })),
    ],
    [tournaments, players],
  )

  const close = useCallback(() => {
    setOpen(false)
    setQ('')
    setTournaments([])
    setPlayers([])
    setActive(0)
    triggerRef.current?.focus()
  }, [])

  // ── query ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const term = q.trim()
    if (term.length < 2) {
      abortRef.current?.abort()
      setTournaments([])
      setPlayers([])
      setLoading(false)
      return
    }

    setLoading(true)
    const timer = setTimeout(() => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      const seq = ++seqRef.current

      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then(r => r.json())
        .then(d => {
          if (seq !== seqRef.current) return
          setTournaments(d.tournaments ?? [])
          setPlayers(d.players ?? [])
          setActive(0)
          setLoading(false)
        })
        .catch(() => {
          if (seq === seqRef.current) setLoading(false)
        })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [q, open])

  // ── keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(v => !v)
        return
      }
      // "/" is a search shortcut only when it is not being typed into a field.
      if (!open && e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    if (e.key === 'Tab') {
      close()
      return
    }
    if (!rows.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(i => (i + 1) % rows.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(i => (i - 1 + rows.length) % rows.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = rows[active]
      if (row) {
        close()
        router.push(row.href)
      }
    }
  }

  function go(row: Row) {
    close()
    router.push(row.href)
  }

  const trigger = (
    <button
      ref={triggerRef}
      onClick={() => setOpen(true)}
      data-tour="search"
      aria-label="Search tournaments and players"
      style={{
        ...mono,
        fontSize: 10,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: C.muted,
        background: 'transparent',
        border: `1px solid ${C.line2}`,
        borderRadius: 3,
        padding: '5px 10px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
      }}
    >
      <span aria-hidden style={{ fontSize: 11, lineHeight: 1 }}>⌕</span>
      Search
      <span style={{ color: C.faint, border: `1px solid ${C.line2}`, borderRadius: 2, padding: '0 3px', fontSize: 9 }}>
        ⌘K
      </span>
    </button>
  )

  if (!open) return trigger

  let idx = -1

  return (
    <>
      {trigger}
      <div
        onClick={close}
        style={{ position: 'fixed', inset: 0, background: 'rgba(29,26,21,0.45)', zIndex: 200, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}
      >
        <div
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          style={{ marginTop: 96, width: 'min(560px, calc(100vw - 32px))', background: C.paper, border: `1px solid ${C.line2}`, borderRadius: 4, boxShadow: '0 24px 60px rgba(29,26,21,0.22)', overflow: 'hidden' }}
        >
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search a tournament or a player…"
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls="search-results"
            aria-autocomplete="list"
            aria-activedescendant={rows.length ? `search-opt-${active}` : undefined}
            style={{ ...serif, width: '100%', boxSizing: 'border-box', fontSize: 19, color: C.ink, background: C.paper, border: 'none', borderBottom: `1px solid ${C.line}`, padding: '16px 18px', outline: 'none' }}
          />

          <div id="search-results" role="listbox" aria-label="Search results" style={{ maxHeight: '52vh', overflowY: 'auto' }}>
            {q.trim().length < 2 ? (
              <Hint text="Type at least two letters. ↑↓ to move, ↵ to open, esc to close." />
            ) : !rows.length ? (
              <Hint text={loading ? 'Searching…' : `Nothing matches “${q.trim()}”.`} />
            ) : (
              <>
                {tournaments.length > 0 && <GroupLabel>Tournaments</GroupLabel>}
                {tournaments.map(t => {
                  idx++
                  const i = idx
                  return (
                    <Option key={`t:${t.slug}`} i={i} activeIndex={active} onHover={setActive} onPick={() => go(rows[i])}>
                      <span style={{ ...serif, fontSize: 15, color: C.ink }}>{t.name}</span>
                      <span style={{ ...mono, fontSize: 10, color: C.faint, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                        {[t.surface, t.tours.join('+'), `${t.matches} matches`].filter(Boolean).join(' · ')}
                      </span>
                    </Option>
                  )
                })}

                {players.length > 0 && <GroupLabel>Players</GroupLabel>}
                {players.map(p => {
                  idx++
                  const i = idx
                  return (
                    <Option key={`p:${p.id}`} i={i} activeIndex={active} onHover={setActive} onPick={() => go(rows[i])}>
                      <span style={{ ...serif, fontSize: 15, color: C.ink }}>{p.name}</span>
                      <span style={{ ...mono, fontSize: 10, color: C.faint, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                        {p.tour} · {p.rank ? `#${p.rank}` : 'unranked'} · Elo {p.elo.toFixed(0)}
                      </span>
                    </Option>
                  )
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ ...mono, fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: BRAND, fontWeight: 600, padding: '12px 18px 6px' }}>
      {children}
    </div>
  )
}

function Hint({ text }: { text: string }) {
  return <div style={{ ...mono, fontSize: 11, color: C.faint, padding: '20px 18px' }}>{text}</div>
}

/**
 * One `active` index drives both keyboard and mouse. Two independent highlight
 * sources would light two rows at once, and there is no :hover CSS anywhere in
 * this codebase to fall back on.
 */
function Option({
  i,
  activeIndex,
  onHover,
  onPick,
  children,
}: {
  i: number
  activeIndex: number
  onHover: (i: number) => void
  onPick: () => void
  children: React.ReactNode
}) {
  const on = i === activeIndex
  return (
    <div
      id={`search-opt-${i}`}
      role="option"
      aria-selected={on}
      onMouseEnter={() => onHover(i)}
      onMouseDown={e => e.preventDefault()}
      onClick={onPick}
      style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '9px 18px', cursor: 'pointer', background: on ? 'rgba(217,118,63,0.10)' : 'transparent', borderLeft: `2px solid ${on ? BRAND : 'transparent'}` }}
    >
      {children}
    </div>
  )
}
