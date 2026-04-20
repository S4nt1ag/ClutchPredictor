export type TeamAbbr =
  | "ATL"
  | "BOS"
  | "BKN"
  | "CHA"
  | "CHI"
  | "CLE"
  | "DAL"
  | "DEN"
  | "DET"
  | "GSW"
  | "HOU"
  | "IND"
  | "LAC"
  | "LAL"
  | "MEM"
  | "MIA"
  | "MIL"
  | "MIN"
  | "NOP"
  | "NYK"
  | "OKC"
  | "ORL"
  | "PHI"
  | "PHX"
  | "POR"
  | "SAC"
  | "SAS"
  | "TOR"
  | "UTA"
  | "WAS";

export type Game = {
  id: string;
  dateISO: string;
  season: number;
  postseason: boolean;
  homeTeamAbbr: TeamAbbr;
  awayTeamAbbr: TeamAbbr;
  homeScore: number;
  awayScore: number;
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

export type PredictResult = {
  homeTeamAbbr: TeamAbbr;
  awayTeamAbbr: TeamAbbr;
  winProbHome: number;
  winProbAway: number;
  model: {
    homeRating: number;
    awayRating: number;
    h2hAdjustment: number;
    homeCourtAdvantage: number;
    injuryAdjustmentHome: number;
    injuryAdjustmentAway: number;
  };
  inputs: {
    season: number;
    lastNGames: number;
    h2hLastNGames: number;
  };
  injuries?: {
    homeTeam: PlayerInjury[];
    awayTeam: PlayerInjury[];
  };
};

export type TitleOddsRow = {
  teamAbbr: TeamAbbr;
  rating: number;
  titleProb: number;
};

