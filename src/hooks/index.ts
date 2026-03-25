// src/hooks/index.ts
import { useState, useEffect, useCallback } from 'react'
import type { Signal, Surface } from '@/types'
import { useSimStore } from '@/store'

export function useMatches(opts: { surface?: Surface | 'all'; signal?: string; status?: string; limit?: number } = {}) {
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetch_ = useCallback(async () => {
    setLoading(true); setError(null)
    const p = new URLSearchParams()
    if (opts.status) p.set('status', opts.status)
    if (opts.surface && opts.surface !== 'all') p.set('surface', opts.surface)
    if (opts.signal && opts.signal !== 'all') p.set('signal', opts.signal)
    if (opts.limit) p.set('limit', String(opts.limit))
    try {
      const res = await fetch(`/api/matches?${p}`)
      const data = await res.json()
      setMatches(data.matches || [])
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [opts.surface, opts.signal, opts.status, opts.limit])
  useEffect(() => { fetch_() }, [fetch_])
  return { matches, loading, error, refetch: fetch_ }
}

export function usePlayers(opts: { tour?: 'ATP' | 'WTA'; surface?: string; limit?: number } = {}) {
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetch_ = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (opts.tour) p.set('tour', opts.tour)
    if (opts.surface) p.set('surface', opts.surface)
    if (opts.limit) p.set('limit', String(opts.limit))
    try {
      const res = await fetch(`/api/players?${p}`)
      const data = await res.json()
      setPlayers(data.players || [])
    } catch (e: any) { setError(e?.message) }
    finally { setLoading(false) }
  }, [opts.tour, opts.surface, opts.limit])
  useEffect(() => { fetch_() }, [fetch_])
  return { players, loading, error, refetch: fetch_ }
}

export function useBets(status = 'all') {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const fetch_ = useCallback(async () => {
    setLoading(true)
    try { const res = await fetch(`/api/bets?status=${status}`); setData(await res.json()) }
    finally { setLoading(false) }
  }, [status])
  useEffect(() => { fetch_() }, [fetch_])
  return { data, loading, refetch: fetch_ }
}

export function useSimulation() {
  const { cache, setResult, setLoading, loading } = useSimStore()
  const [error, setError] = useState<string | null>(null)
  const runSim = useCallback(async (matchId: string, iterations = 10000) => {
    if (cache[matchId]) return cache[matchId]
    if (loading.has(matchId)) return null
    setLoading(matchId, true); setError(null)
    try {
      const res = await fetch('/api/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchId, iterations }) })
      if (!res.ok) throw new Error('Simulation failed')
      const data = await res.json()
      setResult(matchId, data.simulation)
      return data.simulation
    } catch (e: any) { setError(e.message); return null }
    finally { setLoading(matchId, false) }
  }, [cache, loading, setResult, setLoading])
  return { runSim, cache, loading, error }
}