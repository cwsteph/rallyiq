export interface MatchRecord {
  competition_id: string;
  date: string;
  tournament: string;
  surface: string | null;
  round: string;
  best_of: number;
  tour: "ATP" | "WTA";
  winner_espn_id: string;
  winner_name: string;
  loser_espn_id: string;
  loser_name: string;
  score: string;
}

export interface RankingEntry {
  espn_id: string;
  name: string;
  rank: number;
  points: number;
  tour: "ATP" | "WTA";
}

export type FetchFn = (url: string) => Promise<unknown | null>;
