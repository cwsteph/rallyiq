// src/lib/read/buildReadModel.ts
//
// Adapts RallyIQ's existing model output into the view-model that <MatchRead/>
// ("The Read" editorial match view) renders. Pure, no I/O — feed it the values
// page.tsx already computes (probability, edge, odds, sim, factors, h2h).
//
// NOTE on `momentum`: the live win-probability track in the design needs a
// per-point win-prob feed that the app does not yet produce. Until a live feed
// exists, we synthesise a deterministic, clearly-labelled projection from the
// pre-match probability so the UI renders. Replace `synthMomentum` with real
// in-match data when available.

import type { Player, Surface, Signal, ModelFactors, SimulationResult } from '@/types'

export interface ReadPlayer {
  name: string; last: string; initials: string
  country?: string; hand?: string; seed?: number | null; rank?: number
  eloOverall: number; eloSurface: number
  holdPct: number; breakPct: number
  form10: number[]; formScore: number
  ytdWL?: string; surfWL?: string
}

export interface ReadFactor { key: string; favors: 0 | 1 | 2; mag: number; detail: string }

export interface ReadH2H {
  meetings: number; p1Wins: number; p2Wins: number; note: string
  recent: { event: string; surface: string; year: number; winner: 1 | 2; score: string }[]
}

export interface ReadModel {
  tournament: string; surface: Surface; round: string; bestOf: number
  dateLong: string; court?: string; timeLocal?: string
  p1: ReadPlayer; p2: ReadPlayer
  prob1: number; prob2: number
  market: {
    fairOdds1: number; fairAmerican1: string; fairOdds2: number; fairAmerican2: string
    marketOdds1: number; marketAmerican1: string; marketOdds2: number; marketAmerican2: string
    implied1: number; implied2: number
  }
  edge: { value1: number; value2: number; signal: Signal; side: 1 | 2; kellyFraction: number; suggestedStake: number }
  sim: { iterations: number; winProb1: number; avgGames: number; spreadCoverPct: number; over21Pct: number; distribution: Record<string, number> }
  factors: ReadFactor[]
  momentum: { label: string; p1: number }[]
  h2h: ReadH2H
  thesis: { headline: string; body: string; pullQuote: string; line: string; tag: string; pickName: string; signal: Signal }
}

const initials = (name: string) =>
  name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
const lastName = (name: string) => name.split(/\s+/).slice(-1)[0]
const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

function toReadPlayer(p: Player, surface: Surface): ReadPlayer {
  const surfKey = surface === 'Hard' ? 'eloHard' : surface === 'Clay' ? 'eloClay' : 'eloGrass'
  const form10 = (p.form10 as number[]) ?? []
  return {
    name: p.name, last: lastName(p.name), initials: initials(p.name),
    country: p.nationality, hand: p.hand, seed: null, rank: p.currentRank,
    eloOverall: Math.round(p.eloOverall), eloSurface: Math.round((p as any)[surfKey] ?? p.eloOverall),
    holdPct: p.holdPct ?? 0, breakPct: p.breakPct ?? 0,
    form10, formScore: p.formScore ?? form10.filter(Boolean).length,
  }
}

/** signed diff → {favors, mag} where mag is 0..1 (norm = "diff that fills the bar") */
function favorMag(diff: number, norm: number): { favors: 0 | 1 | 2; mag: number } {
  if (Math.abs(diff) < norm * 0.04) return { favors: 0, mag: 0.05 }
  return { favors: diff > 0 ? 1 : 2, mag: clamp01(Math.abs(diff) / norm) }
}

function buildFactors(p1: ReadPlayer, p2: ReadPlayer, surface: Surface, f: ModelFactors): ReadFactor[] {
  const rows: ReadFactor[] = []
  {
    const { favors, mag } = favorMag(p1.eloSurface - p2.eloSurface, 200)
    rows.push({ key: `Surface Elo · ${surface}`, favors, mag, detail: `${p1.eloSurface} vs ${p2.eloSurface} on ${surface.toLowerCase()}.` })
  }
  {
    const { favors, mag } = favorMag(p1.eloOverall - p2.eloOverall, 250)
    rows.push({ key: 'Overall Elo', favors, mag, detail: `${p1.eloOverall} vs ${p2.eloOverall} (${p1.eloOverall - p2.eloOverall >= 0 ? '+' : ''}${p1.eloOverall - p2.eloOverall}).` })
  }
  {
    const { favors, mag } = favorMag(p1.formScore - p2.formScore, 5)
    rows.push({ key: 'Recent Form', favors, mag, detail: `${p1.formScore}/10 vs ${p2.formScore}/10 over the last ten.` })
  }
  {
    const { favors, mag } = favorMag(p1.holdPct - p2.holdPct, 0.12)
    rows.push({ key: 'Serve (Hold %)', favors, mag, detail: `${(p1.holdPct * 100).toFixed(1)}% vs ${(p2.holdPct * 100).toFixed(1)}% of service games held.` })
  }
  {
    const { favors, mag } = favorMag(p1.breakPct - p2.breakPct, 0.25)
    rows.push({ key: 'Return (Break %)', favors, mag, detail: `${(p1.breakPct * 100).toFixed(1)}% vs ${(p2.breakPct * 100).toFixed(1)}% of return games broken.` })
  }
  {
    const { favors, mag } = favorMag(f.fatigueDiff ?? 0, 0.5)
    rows.push({ key: 'Rest / Fatigue', favors, mag, detail: 'Relative match load coming in.' })
  }
  return rows
}

// Deterministic placeholder win-prob path. Replace with a live feed.
function synthMomentum(prob1: number): { label: string; p1: number }[] {
  const base = prob1 * 100
  const labels = ['Start', '1-2', '3-3', '5-4', 'Set 1', 'Break', '2-3', '4-4', '5-5', 'TB']
  return labels.map((label, i) => {
    const wobble = Math.sin(i * 1.1) * 7 + Math.cos(i * 0.6) * 4
    return { label, p1: Math.round(clamp01((base + wobble) / 100) * 100) }
  })
}

function buildThesis(args: {
  p1: ReadPlayer; p2: ReadPlayer; surface: Surface
  prob1: number; signal: Signal; side: 1 | 2
  edge1: number; edge2: number; implied1: number
  marketAmerican2: string; marketOdds2: number
  factors: ReadFactor[]
}): ReadModel['thesis'] {
  const { p1, p2, surface, prob1, signal, side, edge1, edge2, implied1, marketAmerican2, marketOdds2, factors } = args
  const favP = prob1 >= 0.5 ? p1 : p2
  const dogP = prob1 >= 0.5 ? p2 : p1
  const pick = side === 1 ? p1 : p2
  const pickEdge = side === 1 ? edge1 : edge2
  const close = Math.abs(prob1 - 0.5) < 0.04
  const surfaceL = surface.toLowerCase()

  // biggest single factor for the pull-quote
  const top = [...factors].sort((a, b) => b.mag - a.mag)[0]
  const pullQuote = top
    ? `${top.key} is the swing factor — ${top.detail}`
    : `${favP.last} holds a slim edge on ${surfaceL}.`

  let headline: string, body: string, tag: string, line: string
  const edgePct = `${pickEdge >= 0 ? '+' : ''}${(pickEdge * 100).toFixed(1)}%`

  if (signal === 'PASS') {
    headline = close ? `EVEN MONEY: ${favP.last} edges a ${surfaceL}-court coin-flip` : `TOO CLOSE: ${favP.last} the lean, but no value`
    body = `${favP.last} carries the model edge, but the market has it priced almost identically at ${(implied1 * 100).toFixed(1)}% implied. The ${edgePct} edge sits inside the noise band, so there's no value to act on. Recommendation: pass.`
    tag = 'No edge'; line = 'No clear edge to exploit'
  } else if (side !== (prob1 >= 0.5 ? 1 : 2)) {
    // value is on the underdog
    headline = `UNDERDOG PLAY: the favorite is overpriced`
    body = `${favP.last} is the rightful favorite, but the market has carved the line too short. The model gives ${dogP.last} more than the price implies — at ${marketAmerican2} (${marketOdds2}) that's ${edgePct} of value. This is a market-mispricing bet, not a who-wins bet.`
    tag = `${edgePct} edge`; line = `${pick.name} ML ${marketAmerican2} · ${edgePct} value`
  } else {
    headline = `${signal}: ${pick.last} carries the edge on ${surfaceL}`
    body = `The model rates ${pick.last} ahead of where the market has the line. At ${marketAmerican2} (${marketOdds2}) that's ${edgePct} of value — enough to clear the threshold and size a position.`
    tag = `${edgePct} edge`; line = `${pick.name} ML ${marketAmerican2} · ${edgePct} value`
  }

  return { headline, body, pullQuote, line, tag, pickName: pick.name, signal }
}

export function buildReadModel(input: {
  row: any
  p1: Player; p2: Player; surface: Surface
  prob1: number; factors: ModelFactors
  fairOdds1: number; fairOdds2: number; fairAmerican1: string; fairAmerican2: string
  marketOdds1: number; marketOdds2: number; marketAmerican1: string; marketAmerican2: string
  implied1: number; implied2: number
  edge1: number; edge2: number; signal: Signal; kellyFraction: number; suggestedStake: number
  sim: SimulationResult
  h2h: ReadH2H
  dateLong: string; court?: string; timeLocal?: string
}): ReadModel {
  const rp1 = toReadPlayer(input.p1, input.surface)
  const rp2 = toReadPlayer(input.p2, input.surface)
  const prob1 = input.prob1, prob2 = 1 - prob1
  const side: 1 | 2 = input.edge2 > input.edge1 ? 2 : 1
  const factors = buildFactors(rp1, rp2, input.surface, input.factors)

  return {
    tournament: input.row.tournament, surface: input.surface, round: input.row.round,
    bestOf: input.row.best_of ?? 3, dateLong: input.dateLong, court: input.court, timeLocal: input.timeLocal,
    p1: rp1, p2: rp2, prob1, prob2,
    market: {
      fairOdds1: input.fairOdds1, fairAmerican1: input.fairAmerican1, fairOdds2: input.fairOdds2, fairAmerican2: input.fairAmerican2,
      marketOdds1: input.marketOdds1, marketAmerican1: input.marketAmerican1, marketOdds2: input.marketOdds2, marketAmerican2: input.marketAmerican2,
      implied1: input.implied1, implied2: input.implied2,
    },
    edge: { value1: input.edge1, value2: input.edge2, signal: input.signal, side, kellyFraction: input.kellyFraction, suggestedStake: input.suggestedStake },
    sim: {
      iterations: input.sim.iterations, winProb1: input.sim.winProb1, avgGames: input.sim.avgGames,
      spreadCoverPct: input.sim.spreadCoverPct, over21Pct: input.sim.over21Pct, distribution: input.sim.gamesDistribution,
    },
    factors,
    momentum: synthMomentum(prob1),
    h2h: input.h2h,
    thesis: buildThesis({
      p1: rp1, p2: rp2, surface: input.surface, prob1, signal: input.signal, side,
      edge1: input.edge1, edge2: input.edge2, implied1: input.implied1,
      marketAmerican2: side === 2 ? input.marketAmerican2 : input.marketAmerican1,
      marketOdds2: side === 2 ? input.marketOdds2 : input.marketOdds1, factors,
    }),
  }
}
