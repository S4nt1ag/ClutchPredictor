import type { Game, TeamAbbr } from "../types.js";
import type { NbaDataProvider, PlayerAvailability, PlayerInjury, UpcomingGame } from "./provider.js";
import { normalizeBalldontlieSeason } from "../nbaSeason.js";

type BalldontlieTeam = { id: number; abbreviation: string };

type BalldontlieGame = {
  id: number;
  date: string;
  datetime?: string | null;
  season: number;
  postseason: boolean;
  status: string;
  postponed?: boolean;
  home_team_score: number;
  visitor_team_score: number;
  home_team: BalldontlieTeam;
  visitor_team: BalldontlieTeam;
};

type BalldontliePlayer = { id: number; first_name: string; last_name: string };

type BalldontliePlayerInjury = {
  id: number;
  player: BalldontliePlayer;
  team: BalldontlieTeam;
  status: string | null;
  description: string | null;
  updated_at: string | null;
};

function toTeamAbbr(abbr: string): TeamAbbr {
  // balldontlie uses current abbreviations, but a few differ from common fan abbreviations.
  if (abbr === "BKN") return "BKN";
  if (abbr === "CHA") return "CHA";
  if (abbr === "PHX") return "PHX";
  if (abbr === "NOP") return "NOP";
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return abbr as TeamAbbr;
}

function normalizeAvailability(raw: string | null | undefined): PlayerAvailability {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "unknown";
  if (s.includes("out")) return "out";
  if (s.includes("doubtful")) return "doubtful";
  if (s.includes("questionable")) return "questionable";
  if (s.includes("probable")) return "probable";
  if (s.includes("available")) return "available";
  return "unknown";
}

function isFinalishStatus(status: string): boolean {
  // "Final", "Final/OT", etc.
  return status.toLowerCase().startsWith("final");
}

function isLiveStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes("qtr") || s === "halftime";
}

function gameTipoff(g: BalldontlieGame): Date {
  if (g.datetime) return new Date(g.datetime);
  return new Date(`${g.date}T12:00:00.000Z`);
}

/** Próximo jogo = ainda não começou (tipoff no futuro), não final, não adiado, não ao vivo. */
function isScheduledFutureGame(g: BalldontlieGame, now: Date): boolean {
  if (g.postponed) return false;
  if (isFinalishStatus(g.status)) return false;
  if (isLiveStatus(g.status)) return false;
  return gameTipoff(g).getTime() > now.getTime();
}

function formatDateInTimeZone(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}

export class BalldontlieProvider implements NbaDataProvider {
  private readonly baseUrl = "https://api.balldontlie.io/v1";
  private readonly apiKey: string;
  private teamIdByAbbrPromise: Promise<Map<TeamAbbr, number>> | null = null;
  private lastRequestTime = 0;
  private readonly minRequestInterval = 1500; // Rate limit conservador: ~40 requests/min

  // Cache em memória para evitar requisições duplicadas
  private gamesCache = new Map<string, { data: BalldontlieGame[]; timestamp: number }>();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutos

  constructor(input: { apiKey: string }) {
    this.apiKey = input.apiKey;
  }

  private getCacheKey(input: { seasons?: number[]; teamIds?: number[]; start_date?: string; end_date?: string }): string {
    return JSON.stringify(input);
  }

  private getCachedGames(input: { seasons?: number[]; teamIds?: number[]; start_date?: string; end_date?: string }): BalldontlieGame[] | null {
    const key = this.getCacheKey(input);
    const cached = this.gamesCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    return null;
  }

  private setCachedGames(input: { seasons?: number[]; teamIds?: number[]; start_date?: string; end_date?: string }, data: BalldontlieGame[]): void {
    const key = this.getCacheKey(input);
    this.gamesCache.set(key, { data, timestamp: Date.now() });
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private async getJson<T>(path: string, qs?: Record<string, string | number | boolean | undefined>): Promise<T> {
    await this.throttle();
    const url = new URL(`${this.baseUrl}${path}`);
    if (qs) {
      for (const [k, v] of Object.entries(qs)) {
        if (v === undefined) continue;
        url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url, { headers: { Authorization: this.apiKey } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`balldontlie ${res.status} ${res.statusText} for ${url.toString()} ${body}`.trim());
    }
    return (await res.json()) as T;
  }

  /** A API exige `seasons[]` e `team_ids[]` (arrays), não `seasons=` / `team_ids=`. */
  private async getGamesPaged(input: {
    seasons?: number[];
    teamIds?: number[];
    start_date?: string;
    end_date?: string;
    maxPages?: number;
  }): Promise<BalldontlieGame[]> {
    // Verifica cache primeiro
    const cached = this.getCachedGames(input);
    if (cached) {
      return cached;
    }

    const maxPages = Math.min(input.maxPages ?? 40, 3); // Reduzido de 40 para 3 páginas máx
    const out: BalldontlieGame[] = [];
    let cursor: string | number | undefined;

    for (let page = 0; page < maxPages; page++) {
      await this.throttle();
      const url = new URL(`${this.baseUrl}/games`);
      url.searchParams.set("per_page", "100");
      if (cursor != null) url.searchParams.set("cursor", String(cursor));
      for (const s of input.seasons ?? []) url.searchParams.append("seasons[]", String(s));
      for (const id of input.teamIds ?? []) url.searchParams.append("team_ids[]", String(id));
      if (input.start_date) url.searchParams.set("start_date", input.start_date);
      if (input.end_date) url.searchParams.set("end_date", input.end_date);

      const res = await fetch(url, { headers: { Authorization: this.apiKey } });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`balldontlie ${res.status} ${res.statusText} for ${url.toString()} ${body}`.trim());
      }
      const json = (await res.json()) as {
        data: BalldontlieGame[];
        meta?: { next_cursor?: number | null };
      };
      out.push(...json.data);
      if (json.data.length === 0) break;
      const next = json.meta?.next_cursor;
      if (next == null) break;
      cursor = next;
    }

    // Armazena no cache
    this.setCachedGames(input, out);
    return out;
  }

  private async teamIdByAbbr(): Promise<Map<TeamAbbr, number>> {
    if (!this.teamIdByAbbrPromise) {
      this.teamIdByAbbrPromise = (async () => {
        const out = new Map<TeamAbbr, number>();
        const resp = await this.getJson<{ data: Array<{ id: number; abbreviation: string }> }>("/teams");
        for (const t of resp.data) out.set(toTeamAbbr(t.abbreviation), t.id);
        return out;
      })();
    }
    return this.teamIdByAbbrPromise;
  }

  async getAllTeamAbbrs(): Promise<TeamAbbr[]> {
    const map = await this.teamIdByAbbr();
    return [...map.keys()].sort();
  }

  async getRecentGamesForTeam(input: { teamAbbr: TeamAbbr; season: number; limit: number }): Promise<Game[]> {
    const map = await this.teamIdByAbbr();
    const teamId = map.get(input.teamAbbr);
    if (!teamId) throw new Error(`Unknown team abbr: ${input.teamAbbr}`);

    const season = normalizeBalldontlieSeason(input.season);
    const raw = await this.getGamesPaged({
      seasons: [season],
      teamIds: [teamId],
      maxPages: 2  // Reduzido de 8 para 2
    });

    const games = raw
      .filter((g) => isFinalishStatus(g.status))
      .map((g) => ({
        id: String(g.id),
        dateISO: new Date(g.date).toISOString(),
        season: g.season,
        postseason: g.postseason,
        homeTeamAbbr: toTeamAbbr(g.home_team.abbreviation),
        awayTeamAbbr: toTeamAbbr(g.visitor_team.abbreviation),
        homeScore: g.home_team_score,
        awayScore: g.visitor_team_score
      }))
      .sort((a, b) => b.dateISO.localeCompare(a.dateISO));

    return games.slice(0, input.limit);
  }

  async getRecentHeadToHead(input: {
    homeTeamAbbr: TeamAbbr;
    awayTeamAbbr: TeamAbbr;
    season: number;
    limit: number;
  }): Promise<Game[]> {
    const map = await this.teamIdByAbbr();
    const homeId = map.get(input.homeTeamAbbr);
    const awayId = map.get(input.awayTeamAbbr);
    if (!homeId || !awayId) throw new Error(`Unknown team abbr(s): ${input.homeTeamAbbr}, ${input.awayTeamAbbr}`);

    const season = normalizeBalldontlieSeason(input.season);
    const raw = await this.getGamesPaged({
      seasons: [season],
      teamIds: [homeId, awayId],
      maxPages: 2  // Reduzido de 10 para 2
    });

    const games = raw
      .filter((g) => isFinalishStatus(g.status))
      .filter((g) => {
        const a = toTeamAbbr(g.home_team.abbreviation);
        const b = toTeamAbbr(g.visitor_team.abbreviation);
        return (
          (a === input.homeTeamAbbr && b === input.awayTeamAbbr) || (a === input.awayTeamAbbr && b === input.homeTeamAbbr)
        );
      })
      .map((g) => ({
        id: String(g.id),
        dateISO: new Date(g.date).toISOString(),
        season: g.season,
        postseason: g.postseason,
        homeTeamAbbr: toTeamAbbr(g.home_team.abbreviation),
        awayTeamAbbr: toTeamAbbr(g.visitor_team.abbreviation),
        homeScore: g.home_team_score,
        awayScore: g.visitor_team_score
      }))
      .sort((a, b) => b.dateISO.localeCompare(a.dateISO));

    return games.slice(0, input.limit);
  }

  async getUpcomingGames(input: { season: number; daysAhead: number }): Promise<UpcomingGame[]> {
    const tz = "America/New_York";
    const now = new Date();
    const startStr = formatDateInTimeZone(now, tz);
    const endStr = formatDateInTimeZone(new Date(now.getTime() + input.daysAhead * 86400000), tz);

    // Não filtrar por `seasons[]` aqui: ano civil ≠ season da API e quebra a janela de datas.
    const raw = await this.getGamesPaged({
      start_date: startStr,
      end_date: endStr,
      maxPages: 40
    });

    const seasonNorm = normalizeBalldontlieSeason(input.season);
    return raw
      .filter((g) => isScheduledFutureGame(g, now))
      .filter((g) => g.season === seasonNorm)
      .map((g) => ({
        id: String(g.id),
        dateISO: (g.datetime ? new Date(g.datetime) : new Date(`${g.date}T12:00:00.000Z`)).toISOString(),
        season: g.season,
        homeTeamAbbr: toTeamAbbr(g.home_team.abbreviation),
        awayTeamAbbr: toTeamAbbr(g.visitor_team.abbreviation)
      }))
      .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  }

  async getPlayerInjuries(input: { season: number; teamAbbrs?: TeamAbbr[] }): Promise<PlayerInjury[]> {
    // season isn't used by this endpoint, but we keep it in signature for consistency.
    const map = await this.teamIdByAbbr();
    const teamIds = (input.teamAbbrs ?? [])
      .map((a) => map.get(a))
      .filter((x): x is number => typeof x === "number");

    const url = new URL(`${this.baseUrl}/player_injuries`);
    url.searchParams.set("per_page", "100");
    for (const id of teamIds) url.searchParams.append("team_ids[]", String(id));

    const res = await fetch(url, { headers: { Authorization: this.apiKey } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`balldontlie ${res.status} ${res.statusText} for ${url.toString()} ${body}`.trim());
    }
    const json = (await res.json()) as { data: BalldontliePlayerInjury[] };

    return json.data.map((inj) => ({
      playerId: inj.player.id,
      playerName: `${inj.player.first_name} ${inj.player.last_name}`.trim(),
      teamAbbr: toTeamAbbr(inj.team.abbreviation),
      status: normalizeAvailability(inj.status),
      description: inj.description ?? undefined,
      updatedAtISO: inj.updated_at ? new Date(inj.updated_at).toISOString() : undefined
    }));
  }
}

