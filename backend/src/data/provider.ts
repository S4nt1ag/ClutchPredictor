import type { Game, TeamAbbr } from "../types.js";

export type SeasonKey = {
  season: number;
};

export type PlayerAvailability =
  | "available"
  | "probable"
  | "questionable"
  | "doubtful"
  | "out"
  | "unknown";

export type PlayerInjury = {
  playerId: number;
  playerName: string;
  teamAbbr: TeamAbbr;
  status: PlayerAvailability;
  description?: string;
  updatedAtISO?: string;
};

export type UpcomingGame = {
  id: string;
  dateISO: string;
  season: number;
  homeTeamAbbr: TeamAbbr;
  awayTeamAbbr: TeamAbbr;
};

export interface NbaDataProvider {
  getRecentGamesForTeam(input: {
    teamAbbr: TeamAbbr;
    season: number;
    limit: number;
  }): Promise<Game[]>;

  getRecentHeadToHead(input: {
    homeTeamAbbr: TeamAbbr;
    awayTeamAbbr: TeamAbbr;
    season: number;
    limit: number;
  }): Promise<Game[]>;

  getAllTeamAbbrs(): Promise<TeamAbbr[]>;

  getUpcomingGames?(input: { season: number; daysAhead: number }): Promise<UpcomingGame[]>;

  getPlayerInjuries?(input: {
    season: number;
    teamAbbrs?: TeamAbbr[];
  }): Promise<PlayerInjury[]>;
}

