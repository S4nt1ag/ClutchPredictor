import type { Game, TeamAbbr } from "../types.js";
import type { NbaDataProvider } from "./provider.js";

const ALL_TEAMS: TeamAbbr[] = [
  "ATL",
  "BOS",
  "BKN",
  "CHA",
  "CHI",
  "CLE",
  "DAL",
  "DEN",
  "DET",
  "GSW",
  "HOU",
  "IND",
  "LAC",
  "LAL",
  "MEM",
  "MIA",
  "MIL",
  "MIN",
  "NOP",
  "NYK",
  "OKC",
  "ORL",
  "PHI",
  "PHX",
  "POR",
  "SAC",
  "SAS",
  "TOR",
  "UTA",
  "WAS"
];

function seededNumber(seed: string): number {
  // deterministic pseudo-rng in [0,1)
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

function matchupGameId(season: number, a: TeamAbbr, b: TeamAbbr, idx: number) {
  return `mock-${season}-${a}-${b}-${idx}`;
}

function synthGame(input: {
  season: number;
  dateISO: string;
  homeTeamAbbr: TeamAbbr;
  awayTeamAbbr: TeamAbbr;
}): Game {
  const base = 108;
  const homeBoost = 2.2;
  const s = `${input.season}-${input.dateISO}-${input.homeTeamAbbr}-${input.awayTeamAbbr}`;
  const r1 = seededNumber(s);
  const r2 = seededNumber(`${s}-b`);
  const homeScore = Math.round(base + homeBoost + (r1 - 0.5) * 24);
  const awayScore = Math.round(base + (r2 - 0.5) * 24);
  return {
    id: `mock-${s}`,
    dateISO: input.dateISO,
    season: input.season,
    postseason: false,
    homeTeamAbbr: input.homeTeamAbbr,
    awayTeamAbbr: input.awayTeamAbbr,
    homeScore,
    awayScore
  };
}

export class MockProvider implements NbaDataProvider {
  async getAllTeamAbbrs(): Promise<TeamAbbr[]> {
    return ALL_TEAMS;
  }

  async getRecentGamesForTeam(input: {
    teamAbbr: TeamAbbr;
    season: number;
    limit: number;
  }): Promise<Game[]> {
    const games: Game[] = [];
    for (let i = 0; i < input.limit; i++) {
      const opp = ALL_TEAMS[(i + ALL_TEAMS.indexOf(input.teamAbbr) + 7) % ALL_TEAMS.length]!;
      const dateISO = new Date(Date.now() - (i + 1) * 86400000).toISOString();
      const home = i % 2 === 0 ? input.teamAbbr : opp;
      const away = i % 2 === 0 ? opp : input.teamAbbr;
      const g = synthGame({ season: input.season, dateISO, homeTeamAbbr: home, awayTeamAbbr: away });
      games.push({ ...g, id: matchupGameId(input.season, home, away, i) });
    }
    return games;
  }

  async getRecentHeadToHead(input: {
    homeTeamAbbr: TeamAbbr;
    awayTeamAbbr: TeamAbbr;
    season: number;
    limit: number;
  }): Promise<Game[]> {
    const games: Game[] = [];
    for (let i = 0; i < input.limit; i++) {
      const dateISO = new Date(Date.now() - (i + 3) * 86400000).toISOString();
      const home = i % 2 === 0 ? input.homeTeamAbbr : input.awayTeamAbbr;
      const away = i % 2 === 0 ? input.awayTeamAbbr : input.homeTeamAbbr;
      games.push({
        ...synthGame({ season: input.season, dateISO, homeTeamAbbr: home, awayTeamAbbr: away }),
        id: matchupGameId(input.season, home, away, i)
      });
    }
    return games;
  }

  async getUpcomingGames(input: { season: number; daysAhead: number }) {
    const today = new Date();
    const games = [];
    for (let i = 0; i < Math.min(20, input.daysAhead * 2); i++) {
      const home = ALL_TEAMS[i % ALL_TEAMS.length]!;
      const away = ALL_TEAMS[(i + 9) % ALL_TEAMS.length]!;
      const dateISO = new Date(today.getTime() + (i + 1) * 6 * 3600_000).toISOString();
      games.push({ id: `mock-up-${input.season}-${i}`, dateISO, season: input.season, homeTeamAbbr: home, awayTeamAbbr: away });
    }
    return games;
  }

  async getPlayerInjuries() {
    return [];
  }
}

