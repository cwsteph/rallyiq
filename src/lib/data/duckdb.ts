import fs from 'fs'
import path from 'path'

const RATINGS_PATH = path.join(process.cwd(), 'data', 'ratings.json')
const DATA_TODAY   = path.join(process.cwd(), 'data', 'today.json')
const TMP_TODAY    = '/tmp/today.json'

function getTodayPath(): string {
  if (fs.existsSync(TMP_TODAY)) return TMP_TODAY
  return DATA_TODAY
}

export interface DBRating { player_id:string;name:string;tour:string;elo_overall:number;elo_hard:number;elo_clay:number;elo_grass:number;hold_pct:number;break_pct:number;form_score:number;form_json:string;current_rank:number|null;matches_played:number }
export interface DBMatch { match_id:string;tournament:string;surface:string;round:string;best_of:number;match_date:string;scheduled_time?:string;player1_id:string;player1_name:string;player2_id:string;player2_name:string;source:string }

function readRatings(): DBRating[] {
  if (!fs.existsSync(RATINGS_PATH)) return []
  try { return JSON.parse(fs.readFileSync(RATINGS_PATH,'utf8')) } catch { return [] }
}

function readToday(): DBMatch[] {
  const p = getTodayPath()
  if (!fs.existsSync(p)) return []
  try { return JSON.parse(fs.readFileSync(p,'utf8')) } catch { return [] }
}

export async function getPlayers(tour?:'ATP'|'WTA'): Promise<DBRating[]> {
  const all = readRatings()
  return (tour ? all.filter(p=>p.tour===tour) : all).sort((a,b)=>b.elo_overall-a.elo_overall).slice(0,200)
}

export async function getPlayer(id:string): Promise<DBRating|null> {
  return readRatings().find(p=>p.player_id===id) ?? null
}

export async function getTodayMatches(): Promise<any[]> {
  const ratings = readRatings()
  const map = new Map(ratings.map(r=>[r.player_id,r]))
  return readToday().map(m=>({
    ...m,
    p1_elo_overall:map.get(m.player1_id)?.elo_overall??1500, p1_elo_hard:map.get(m.player1_id)?.elo_hard??1500,
    p1_elo_clay:map.get(m.player1_id)?.elo_clay??1500, p1_elo_grass:map.get(m.player1_id)?.elo_grass??1500,
    p1_hold_pct:map.get(m.player1_id)?.hold_pct??0.75, p1_break_pct:map.get(m.player1_id)?.break_pct??0.25,
    p1_form_score:map.get(m.player1_id)?.form_score??0.5, p1_form_json:map.get(m.player1_id)?.form_json??'[]',
    p1_rank:map.get(m.player1_id)?.current_rank??null,
    p2_elo_overall:map.get(m.player2_id)?.elo_overall??1500, p2_elo_hard:map.get(m.player2_id)?.elo_hard??1500,
    p2_elo_clay:map.get(m.player2_id)?.elo_clay??1500, p2_elo_grass:map.get(m.player2_id)?.elo_grass??1500,
    p2_hold_pct:map.get(m.player2_id)?.hold_pct??0.75, p2_break_pct:map.get(m.player2_id)?.break_pct??0.25,
    p2_form_score:map.get(m.player2_id)?.form_score??0.5, p2_form_json:map.get(m.player2_id)?.form_json??'[]',
    p2_rank:map.get(m.player2_id)?.current_rank??null,
  })).sort((a,b)=>(a.scheduled_time??'99:99').localeCompare(b.scheduled_time??'99:99'))
}

export async function getTodayMatch(matchId:string): Promise<any|null> {
  return (await getTodayMatches()).find(m=>m.match_id===matchId) ?? null
}

export async function getH2H(p1Id?: string, p2Id?: string): Promise<any[]> { return [] }
export async function getBacktestMatches(surface?: string, limit?: number): Promise<any[]> { return [] }
export async function rawQuery<T=any>(sql?: string): Promise<T[]> { return [] }
