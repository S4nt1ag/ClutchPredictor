import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { BalldontlieProvider } from "./data/balldontlieProvider.js";
import { PredictorService } from "./service/predictor.js";
import type { TeamAbbr } from "./types.js";
import { normalizeBalldontlieSeason, nbaSeasonStartYearFromDate } from "./nbaSeason.js";

const TeamAbbrSchema = z.enum([
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
]);

const app = Fastify({ logger: true });
await app.register(cors, {
  origin: true
});

const apiKey = process.env.BALLDONTLIE_API_KEY;
if (!apiKey) {
  throw new Error("BALLDONTLIE_API_KEY environment variable is required");
}
const provider = new BalldontlieProvider({ apiKey });
const predictor = new PredictorService(provider);

app.get("/health", async () => ({ ok: true }));

app.get("/api/predict", async (req) => {
  const querySchema = z.object({
    homeTeamAbbr: TeamAbbrSchema,
    awayTeamAbbr: TeamAbbrSchema,
    season: z.coerce.number().int().min(1946).max(2100).default(nbaSeasonStartYearFromDate()),
    lastNGames: z.coerce.number().int().min(1).max(40).optional(),
    h2hLastNGames: z.coerce.number().int().min(0).max(20).optional()
  });

  const q = querySchema.parse(req.query);
  const season = normalizeBalldontlieSeason(q.season);
  return predictor.predictMatchup({
    homeTeamAbbr: q.homeTeamAbbr as TeamAbbr,
    awayTeamAbbr: q.awayTeamAbbr as TeamAbbr,
    season,
    lastNGames: q.lastNGames,
    h2hLastNGames: q.h2hLastNGames
  });
});

app.get("/api/title-odds", async (req) => {
  const querySchema = z.object({
    season: z.coerce.number().int().min(1946).max(2100).default(nbaSeasonStartYearFromDate()),
    lastNGames: z.coerce.number().int().min(1).max(60).optional()
  });
  const q = querySchema.parse(req.query);
  const season = normalizeBalldontlieSeason(q.season);
  return predictor.titleOdds({ season, lastNGames: q.lastNGames });
});

app.get("/api/upcoming", async (req) => {
  const querySchema = z.object({
    season: z.coerce.number().int().min(1946).max(2100).default(nbaSeasonStartYearFromDate()),
    daysAhead: z.coerce.number().int().min(1).max(14).default(7)
  });
  const q = querySchema.parse(req.query);
  if (!provider.getUpcomingGames) {
    return { games: [] };
  }
  const season = normalizeBalldontlieSeason(q.season);
  const games = await provider.getUpcomingGames({ season, daysAhead: q.daysAhead });
  return { games };
});

app.get("/api/predict-upcoming", async (req) => {
  const querySchema = z.object({
    season: z.coerce.number().int().min(1946).max(2100).default(nbaSeasonStartYearFromDate()),
    daysAhead: z.coerce.number().int().min(1).max(14).default(3),
    lastNGames: z.coerce.number().int().min(1).max(40).optional(),
    h2hLastNGames: z.coerce.number().int().min(0).max(20).optional()
  });
  const q = querySchema.parse(req.query);
  if (!provider.getUpcomingGames) return { predictions: [], games: [] };
  const season = normalizeBalldontlieSeason(q.season);
  const upcoming = await provider.getUpcomingGames({ season, daysAhead: q.daysAhead });
  const predictions = await Promise.all(
    upcoming.map(async (g) =>
      predictor.predictMatchup({
        homeTeamAbbr: g.homeTeamAbbr,
        awayTeamAbbr: g.awayTeamAbbr,
        season,
        lastNGames: q.lastNGames,
        h2hLastNGames: q.h2hLastNGames
      })
    )
  );
  return { predictions, games: upcoming };
});

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";

await app.listen({ port, host });

