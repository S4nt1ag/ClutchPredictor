import type { NbaDataProvider } from "../data/provider.js";
import type { PredictResult, TeamAbbr, TitleOddsRow } from "../types.js";
import { HOME_ADV, eloFromRecentGames, h2hAdjustment, winProbFromRatings } from "../model/elo.js";
import type { PlayerAvailability, PlayerInjury } from "../data/provider.js";

function probFromAvailability(status: PlayerAvailability): number {
  switch (status) {
    case "available":
      return 1;
    case "probable":
      return 0.85;
    case "questionable":
      return 0.5;
    case "doubtful":
      return 0.1;
    case "out":
      return 0;
    default:
      return 0.5;
  }
}

function injuryImpactElo(status: PlayerAvailability): number {
  // v1 heuristic: if a player is likely out, deduct rating a bit.
  // This is intentionally modest to avoid overfitting without on/off data.
  switch (status) {
    case "out":
      return -18;
    case "doubtful":
      return -14;
    case "questionable":
      return -9;
    case "probable":
      return -4;
    case "available":
      return 0;
    default:
      return -6;
  }
}

function expectedInjuryAdjustment(injuries: PlayerInjury[]): number {
  // Expected adjustment = sum over players of (1-p(play)) * impactIfOut
  // impactIfOut is negative; so the net adjustment is negative or 0.
  let adj = 0;
  for (const inj of injuries) {
    const p = probFromAvailability(inj.status);
    const impact = injuryImpactElo(inj.status);
    // If status says "out", p=0 and impact is most negative. If "probable", p~0.85 and impact small.
    adj += (1 - p) * impact;
  }
  // cap
  return Math.max(-60, Math.min(0, adj));
}

function normalizeProbs(rows: Array<{ teamAbbr: TeamAbbr; score: number }>): TitleOddsRow[] {
  const total = rows.reduce((acc, r) => acc + r.score, 0);
  return rows
    .map((r) => ({
      teamAbbr: r.teamAbbr,
      rating: r.score,
      titleProb: total > 0 ? r.score / total : 0
    }))
    .sort((a, b) => b.titleProb - a.titleProb);
}

export class PredictorService {
  constructor(private readonly provider: NbaDataProvider) {}

  async predictMatchup(input: {
    homeTeamAbbr: TeamAbbr;
    awayTeamAbbr: TeamAbbr;
    season: number;
    lastNGames?: number;
    h2hLastNGames?: number;
  }): Promise<PredictResult> {
    const lastNGames = input.lastNGames ?? 12;
    const h2hLastNGames = input.h2hLastNGames ?? 6;

    const [homeRecent, awayRecent, h2h, injuriesAll] = await Promise.all([
      this.provider.getRecentGamesForTeam({
        teamAbbr: input.homeTeamAbbr,
        season: input.season,
        limit: lastNGames
      }),
      this.provider.getRecentGamesForTeam({
        teamAbbr: input.awayTeamAbbr,
        season: input.season,
        limit: lastNGames
      }),
      this.provider.getRecentHeadToHead({
        homeTeamAbbr: input.homeTeamAbbr,
        awayTeamAbbr: input.awayTeamAbbr,
        season: input.season,
        limit: h2hLastNGames
      }),
      this.provider.getPlayerInjuries
        ? this.provider.getPlayerInjuries({ season: input.season, teamAbbrs: [input.homeTeamAbbr, input.awayTeamAbbr] })
        : Promise.resolve([])
    ]);

    const homeRating = eloFromRecentGames({ teamAbbr: input.homeTeamAbbr, recentGames: homeRecent });
    const awayRating = eloFromRecentGames({ teamAbbr: input.awayTeamAbbr, recentGames: awayRecent });
    const h2hAdj = h2hAdjustment({
      homeTeamAbbr: input.homeTeamAbbr,
      awayTeamAbbr: input.awayTeamAbbr,
      h2hGames: h2h
    });

    const injuriesHome = injuriesAll.filter((i) => i.teamAbbr === input.homeTeamAbbr);
    const injuriesAway = injuriesAll.filter((i) => i.teamAbbr === input.awayTeamAbbr);
    const injuryAdjHome = expectedInjuryAdjustment(injuriesHome);
    const injuryAdjAway = expectedInjuryAdjustment(injuriesAway);

    const { winProbHome, winProbAway } = winProbFromRatings({
      homeRating,
      awayRating,
      h2hAdj,
      injuryAdjHome,
      injuryAdjAway
    });

    return {
      homeTeamAbbr: input.homeTeamAbbr,
      awayTeamAbbr: input.awayTeamAbbr,
      winProbHome,
      winProbAway,
      model: {
        homeRating,
        awayRating,
        h2hAdjustment: h2hAdj,
        homeCourtAdvantage: HOME_ADV,
        injuryAdjustmentHome: injuryAdjHome,
        injuryAdjustmentAway: injuryAdjAway
      },
      inputs: { season: input.season, lastNGames, h2hLastNGames },
      injuries: { homeTeam: injuriesHome, awayTeam: injuriesAway }
    };
  }

  async titleOdds(input: { season: number; lastNGames?: number }): Promise<TitleOddsRow[]> {
    const lastNGames = input.lastNGames ?? 16;
    const teams = await this.provider.getAllTeamAbbrs();
    const ratings = await Promise.all(
      teams.map(async (teamAbbr) => {
        const recentGames = await this.provider.getRecentGamesForTeam({
          teamAbbr,
          season: input.season,
          limit: lastNGames
        });
        const rating = eloFromRecentGames({ teamAbbr, recentGames });
        return { teamAbbr, score: Math.max(1, rating - 1200) };
      })
    );
    return normalizeProbs(ratings);
  }
}

