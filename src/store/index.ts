// src/store/index.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Signal, Surface } from '@/types'

// ── Filters ───────────────────────────────────────────────────────────────────
interface FiltersState {
  matchSurface: Surface | 'all'
  matchSignal: Signal | 'all'
  rankingTour: 'ATP' | 'WTA'
  rankingSurface: 'overall' | 'hard' | 'clay' | 'grass'
  setMatchSurface: (s: Surface | 'all') => void
  setMatchSignal: (s: Signal | 'all') => void
  setRankingTour: (t: 'ATP' | 'WTA') => void
  setRankingSurface: (s: 'overall' | 'hard' | 'clay' | 'grass') => void
}

export const useFilters = create<FiltersState>()(
  persist(
    (set) => ({
      matchSurface: 'all',
      matchSignal: 'all',
      rankingTour: 'ATP',
      rankingSurface: 'overall',
      setMatchSurface: (s) => set({ matchSurface: s }),
      setMatchSignal: (s) => set({ matchSignal: s }),
      setRankingTour: (t) => set({ rankingTour: t }),
      setRankingSurface: (s) => set({ rankingSurface: s }),
    }),
    { name: 'rallyiq-filters' }
  )
)

// ── Bankroll ──────────────────────────────────────────────────────────────────
interface BankrollState {
  balance: number
  startingBalance: number
  setBalance: (b: number) => void
}

export const useBankroll = create<BankrollState>()(
  persist(
    (set) => ({
      balance: 100,
      startingBalance: 100,
      setBalance: (b) => set({ balance: b }),
    }),
    { name: 'rallyiq-bankroll' }
  )
)

// ── UI ────────────────────────────────────────────────────────────────────────
interface UIState {
  sidebarOpen: boolean
  selectedMatchId: string | null
  setSidebarOpen: (v: boolean) => void
  setSelectedMatch: (id: string | null) => void
}

export const useUI = create<UIState>((set) => ({
  sidebarOpen: true,
  selectedMatchId: null,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setSelectedMatch: (id) => set({ selectedMatchId: id }),
}))

// ── Simulation cache ──────────────────────────────────────────────────────────
interface SimCache {
  [matchId: string]: {
    winProb1: number
    winProb2: number
    avgGames: number
    gamesDistribution: Record<string, number>
    spreadCoverPct: number
    over21Pct: number
    iterations: number
  }
}

interface SimState {
  cache: SimCache
  loading: Set<string>
  setResult: (matchId: string, result: SimCache[string]) => void
  setLoading: (matchId: string, v: boolean) => void
  getResult: (matchId: string) => SimCache[string] | undefined
}

export const useSimStore = create<SimState>((set, get) => ({
  cache: {},
  loading: new Set(),
  setResult: (matchId, result) =>
    set((s) => ({ cache: { ...s.cache, [matchId]: result } })),
  setLoading: (matchId, v) =>
    set((s) => {
      const next = new Set(s.loading)
      v ? next.add(matchId) : next.delete(matchId)
      return { loading: next }
    }),
  getResult: (matchId) => get().cache[matchId],
}))
