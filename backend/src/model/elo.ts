import type { Game, TeamAbbr } from "../types.js";

const BASE_RATING = 1500;
const K = 24;
export const HOME_ADV = 55; // elo points (~3 pts)

function expectedScore(ra: number, rb: number) {
  return 1 / (1 + 10 ** ((rb - ra) / 400));
}

function clamp01(x: number) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export function eloFromRecentGames(input: {
  teamAbbr: TeamAbbr;
  recentGames: Game[];
}): number {
  let r = BASE_RATING;
  for (const g of input.recentGames) {
    const isHome = g.homeTeamAbbr === input.teamAbbr;
    const scored = isHome ? g.homeScore : g.awayScore;
    const allowed = isHome ? g.awayScore : g.homeScore;
    const won = scored > allowed ? 1 : 0;
    const margin = Math.abs(scored - allowed);
    const marginMult = Math.log(margin + 1) / Math.log(10); // 0..~2
    const oppR = BASE_RATING;
    const ra = r + (isHome ? HOME_ADV : 0);
    const ea = expectedScore(ra, oppR);
    r = r + K * marginMult * (won - ea);
  }
  return r;
}

export function h2hAdjustment(input: {
  homeTeamAbbr: TeamAbbr;
  awayTeamAbbr: TeamAbbr;
  h2hGames: Game[];
}): number {
  // positive favors home, negative favors away
  if (input.h2hGames.length === 0) return 0;
  let net = 0;
  for (const g of input.h2hGames) {
    const homePts = g.homeScore;
    const awayPts = g.awayScore;
    const winner = homePts > awayPts ? g.homeTeamAbbr : g.awayTeamAbbr;
    net += winner === input.homeTeamAbbr ? 1 : -1;
  }
  return Math.max(-35, Math.min(35, net * 6)); // cap impact
}

export function winProbFromRatings(input: {
  homeRating: number;
  awayRating: number;
  h2hAdj: number;
  injuryAdjHome?: number;
  injuryAdjAway?: number;
}): { winProbHome: number; winProbAway: number } {
  const ra = input.homeRating + HOME_ADV + input.h2hAdj + (input.injuryAdjHome ?? 0);
  const rb = input.awayRating + (input.injuryAdjAway ?? 0);
  const pHome = clamp01(expectedScore(ra, rb));
  return { winProbHome: pHome, winProbAway: 1 - pHome };
}

