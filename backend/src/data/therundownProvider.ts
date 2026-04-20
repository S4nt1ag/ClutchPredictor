import type { Game, TeamAbbr } from "../types.js";
import type { NbaDataProvider, UpcomingGame } from "./provider.js";

/**
 * TheRundown API Provider
 * 
 * Plano gratuito: 20,000 data points/dia, 1 req/sec rate limit
 * Sport ID para NBA: 4
 * 
 * Documentação: https://docs.therundown.io/
 */

type TheRundownTeam = {
  name: string;
  is_away: boolean;
};

type TheRundownEvent = {
  event_id: string;
  sport_id: number;
  event_date: string;
  teams: TheRundownTeam[];
  score?: {
    score_away?: number;
    score_home?: number;
  };
  status?: string;
  scheduled?: string;
};

type TheRundownSport = {
  sport_id: number;
  sport_name: string;
};

// Mapeamento de nomes TheRundown para abreviações do nosso sistema
const TEAM_NAME_TO_ABBR: Record<string, TeamAbbr> = {
  "Atlanta Hawks": "ATL",
  "Boston Celtics": "BOS",
  "Brooklyn Nets": "BKN",
  "Charlotte Hornets": "CHA",
  "Chicago Bulls": "CHI",
  "Cleveland Cavaliers": "CLE",
  "Dallas Mavericks": "DAL",
  "Denver Nuggets": "DEN",
  "Detroit Pistons": "DET",
  "Golden State Warriors": "GSW",
  "Houston Rockets": "HOU",
  "Indiana Pacers": "IND",
  "LA Clippers": "LAC",
  "Los Angeles Lakers": "LAL",
  "Memphis Grizzlies": "MEM",
  "Miami Heat": "MIA",
  "Milwaukee Bucks": "MIL",
  "Minnesota Timberwolves": "MIN",
  "New Orleans Pelicans": "NOP",
  "New York Knicks": "NYK",
  "Oklahoma City Thunder": "OKC",
  "Orlando Magic": "ORL",
  "Philadelphia 76ers": "PHI",
  "Phoenix Suns": "PHX",
  "Portland Trail Blazers": "POR",
  "Sacramento Kings": "SAC",
  "San Antonio Spurs": "SAS",
  "Toronto Raptors": "TOR",
  "Utah Jazz": "UTA",
  "Washington Wizards": "WAS",
};

const NBA_SPORT_ID = 4;

export class TheRundownProvider implements NbaDataProvider {
  private readonly baseUrl = "https://therundown.io/api/v2";
  private readonly apiKey: string;
  private lastRequestTime = 0;
  private readonly minRequestInterval = 1500; // Rate limit: 1 req/sec - margem de segurança

  // Cache em memória
  private eventsCache = new Map<string, { data: TheRundownEvent[]; timestamp: number }>();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutos

  constructor(input: { apiKey: string }) {
    this.apiKey = input.apiKey;
  }

  private getCacheKey(input: Record<string, unknown>): string {
    return JSON.stringify(input);
  }

  private getCachedEvents(input: Record<string, unknown>): TheRundownEvent[] | null {
    const key = this.getCacheKey(input);
    const cached = this.eventsCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    return null;
  }

  private setCachedEvents(input: Record<string, unknown>, data: TheRundownEvent[]): void {
    const key = this.getCacheKey(input);
    this.eventsCache.set(key, { data, timestamp: Date.now() });
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
    // A API key deve ser passada como query parameter, não como header
    url.searchParams.set("key", this.apiKey);
    if (qs) {
      for (const [k, v] of Object.entries(qs)) {
        if (v === undefined) continue;
        url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`TheRundown ${res.status} ${res.statusText} for ${url.toString()} ${body}`.trim());
    }
    return (await res.json()) as T;
  }

  private teamNameToAbbr(name: string): TeamAbbr | null {
    return TEAM_NAME_TO_ABBR[name] ?? null;
  }

  private isFinalStatus(status?: string): boolean {
    if (!status) return false;
    const s = status.toLowerCase();
    return s === "final" || s.includes("final");
  }

  async getAllTeamAbbrs(): Promise<TeamAbbr[]> {
    return Object.values(TEAM_NAME_TO_ABBR);
  }

  async getRecentGamesForTeam(input: {
    teamAbbr: TeamAbbr;
    season: number;
    limit: number;
  }): Promise<Game[]> {
    // TheRundown usa datas, não temos acesso direto a jogos por time
    // Vamos buscar jogos de uma faixa de datas e filtrar
    const cacheKey = { type: "recentGames", teamAbbr: input.teamAbbr, season: input.season, limit: input.limit };
    const cached = this.getCachedEvents(cacheKey);
    
    if (cached) {
      return this.filterGamesForTeam(cached, input.teamAbbr, input.limit);
    }

    // Buscar jogos dos últimos 30 dias
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const events = await this.fetchEventsByDateRange(startDate, endDate);
    this.setCachedEvents(cacheKey, events);

    return this.filterGamesForTeam(events, input.teamAbbr, input.limit);
  }

  private filterGamesForTeam(events: TheRundownEvent[], teamAbbr: TeamAbbr, limit: number): Game[] {
    const games: Game[] = [];

    for (const event of events) {
      if (games.length >= limit) break;
      if (!this.isFinalStatus(event.status)) continue;

      const homeTeam = event.teams.find(t => !t.is_away);
      const awayTeam = event.teams.find(t => t.is_away);

      if (!homeTeam || !awayTeam) continue;

      const homeAbbr = this.teamNameToAbbr(homeTeam.name);
      const awayAbbr = this.teamNameToAbbr(awayTeam.name);

      if (!homeAbbr || !awayAbbr) continue;

      if (homeAbbr === teamAbbr || awayAbbr === teamAbbr) {
        const isHome = homeAbbr === teamAbbr;
        games.push({
          id: event.event_id,
          date: event.event_date,
          season: 2025, // TheRundown não retorna a temporada diretamente
          homeTeamAbbr: homeAbbr,
          awayTeamAbbr: awayAbbr,
          homeScore: event.score?.score_home ?? 0,
          awayScore: event.score?.score_away ?? 0,
          isHomeTeamWinner: (event.score?.score_home ?? 0) > (event.score?.score_away ?? 0),
          isClutch: false, // TheRundown não fornece dados de clutch
        });
      }
    }

    return games;
  }

  async getRecentHeadToHead(input: {
    homeTeamAbbr: TeamAbbr;
    awayTeamAbbr: TeamAbbr;
    season: number;
    limit: number;
  }): Promise<Game[]> {
    const cacheKey = { type: "h2h", home: input.homeTeamAbbr, away: input.awayTeamAbbr, season: input.season, limit: input.limit };
    const cached = this.getCachedEvents(cacheKey);
    
    if (cached) {
      return this.filterHeadToHead(cached, input.homeTeamAbbr, input.awayTeamAbbr, input.limit);
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90); // Buscar últimos 90 dias

    const events = await this.fetchEventsByDateRange(startDate, endDate);
    this.setCachedEvents(cacheKey, events);

    return this.filterHeadToHead(events, input.homeTeamAbbr, input.awayTeamAbbr, input.limit);
  }

  private filterHeadToHead(events: TheRundownEvent[], homeAbbr: TeamAbbr, awayAbbr: TeamAbbr, limit: number): Game[] {
    const games: Game[] = [];

    for (const event of events) {
      if (games.length >= limit) break;
      if (!this.isFinalStatus(event.status)) continue;

      const homeTeam = event.teams.find(t => !t.is_away);
      const awayTeam = event.teams.find(t => t.is_away);

      if (!homeTeam || !awayTeam) continue;

      const eventHomeAbbr = this.teamNameToAbbr(homeTeam.name);
      const eventAwayAbbr = this.teamNameToAbbr(awayTeam.name);

      // Verificar se é o confronto (em qualquer ordem)
      const isMatch = 
        (eventHomeAbbr === homeAbbr && eventAwayAbbr === awayAbbr) ||
        (eventHomeAbbr === awayAbbr && eventAwayAbbr === homeAbbr);

      if (!isMatch) continue;
      if (!eventHomeAbbr || !eventAwayAbbr) continue;

      const isHomeTeamHome = eventHomeAbbr === homeAbbr;
      games.push({
        id: event.event_id,
        date: event.event_date,
        season: 2025,
        homeTeamAbbr: eventHomeAbbr,
        awayTeamAbbr: eventAwayAbbr,
        homeScore: event.score?.score_home ?? 0,
        awayScore: event.score?.score_away ?? 0,
        isHomeTeamWinner: (event.score?.score_home ?? 0) > (event.score?.score_away ?? 0),
        isClutch: false,
      });
    }

    return games;
  }

  private async fetchEventsByDateRange(startDate: Date, endDate: Date): Promise<TheRundownEvent[]> {
    const allEvents: TheRundownEvent[] = [];
    const currentDate = new Date(startDate);
    const maxDays = 14; // Limitar a 14 dias para evitar rate limit
    let daysFetched = 0;

    while (currentDate <= endDate && daysFetched < maxDays) {
      const dateStr = currentDate.toISOString().split("T")[0];
      try {
        const response = await this.getJson<{ events?: TheRundownEvent[] }>(
          `/sports/${NBA_SPORT_ID}/events/${dateStr}`
        );
        if (response.events) {
          allEvents.push(...response.events);
        }
      } catch (error) {
        // Log apenas em desenvolvimento, não throw para evitar quebrar tudo
        console.error(`Error fetching events for ${dateStr}:`, (error as Error).message);
      }
      currentDate.setDate(currentDate.getDate() + 1);
      daysFetched++;
    }

    return allEvents;
  }

  async getUpcomingGames(input: { season: number; daysAhead: number }): Promise<UpcomingGame[]> {
    const cacheKey = { type: "upcoming", season: input.season, daysAhead: input.daysAhead };
    const cached = this.getCachedEvents(cacheKey);
    
    if (cached) {
      return this.filterUpcomingGames(cached, input.daysAhead);
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + input.daysAhead);

    const events = await this.fetchEventsByDateRange(new Date(), endDate);
    this.setCachedEvents(cacheKey, events);

    return this.filterUpcomingGames(events, input.daysAhead);
  }

  private filterUpcomingGames(events: TheRundownEvent[], daysAhead: number): UpcomingGame[] {
    const upcoming: UpcomingGame[] = [];
    const now = new Date();
    const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    for (const event of events) {
      if (this.isFinalStatus(event.status)) continue;
      if (event.scheduled) {
        const eventDate = new Date(event.scheduled);
        if (eventDate > cutoff) continue;
      }

      const homeTeam = event.teams.find(t => !t.is_away);
      const awayTeam = event.teams.find(t => t.is_away);

      if (!homeTeam || !awayTeam) continue;

      const homeAbbr = this.teamNameToAbbr(homeTeam.name);
      const awayAbbr = this.teamNameToAbbr(awayTeam.name);

      if (!homeAbbr || !awayAbbr) continue;

      upcoming.push({
        id: event.event_id,
        dateISO: event.scheduled || event.event_date,
        season: 2025,
        homeTeamAbbr: homeAbbr,
        awayTeamAbbr: awayAbbr,
      });
    }

    return upcoming;
  }
}