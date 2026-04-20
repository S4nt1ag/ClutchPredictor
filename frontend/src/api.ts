export type TeamAbbr =
  | 'ATL'
  | 'BOS'
  | 'BKN'
  | 'CHA'
  | 'CHI'
  | 'CLE'
  | 'DAL'
  | 'DEN'
  | 'DET'
  | 'GSW'
  | 'HOU'
  | 'IND'
  | 'LAC'
  | 'LAL'
  | 'MEM'
  | 'MIA'
  | 'MIL'
  | 'MIN'
  | 'NOP'
  | 'NYK'
  | 'OKC'
  | 'ORL'
  | 'PHI'
  | 'PHX'
  | 'POR'
  | 'SAC'
  | 'SAS'
  | 'TOR'
  | 'UTA'
  | 'WAS'

export const ALL_TEAMS: TeamAbbr[] = [
  'ATL',
  'BOS',
  'BKN',
  'CHA',
  'CHI',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GSW',
  'HOU',
  'IND',
  'LAC',
  'LAL',
  'MEM',
  'MIA',
  'MIL',
  'MIN',
  'NOP',
  'NYK',
  'OKC',
  'ORL',
  'PHI',
  'PHX',
  'POR',
  'SAC',
  'SAS',
  'TOR',
  'UTA',
  'WAS'
]

export type PredictResult = {
  homeTeamAbbr: TeamAbbr
  awayTeamAbbr: TeamAbbr
  winProbHome: number
  winProbAway: number
  model: {
    homeRating: number
    awayRating: number
    h2hAdjustment: number
    homeCourtAdvantage?: number
    injuryAdjustmentHome?: number
    injuryAdjustmentAway?: number
  }
  inputs: {
    season: number
    lastNGames: number
    h2hLastNGames: number
  }
}

export type UpcomingGame = {
  id: string
  dateISO: string
  season: number
  homeTeamAbbr: TeamAbbr
  awayTeamAbbr: TeamAbbr
}

export type PredictUpcomingResponse = {
  predictions: PredictResult[]
  games?: UpcomingGame[]
}

export type TitleOddsRow = {
  teamAbbr: TeamAbbr
  rating: number
  titleProb: number
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`)
  }
  return (await res.json()) as T
}

export function predictMatchup(input: {
  homeTeamAbbr: TeamAbbr
  awayTeamAbbr: TeamAbbr
  season: number
  lastNGames: number
  h2hLastNGames: number
}) {
  const qs = new URLSearchParams({
    homeTeamAbbr: input.homeTeamAbbr,
    awayTeamAbbr: input.awayTeamAbbr,
    season: String(input.season),
    lastNGames: String(input.lastNGames),
    h2hLastNGames: String(input.h2hLastNGames)
  })
  return getJson<PredictResult>(`/api/predict?${qs.toString()}`)
}

export function getTitleOdds(input: { season: number; lastNGames: number }) {
  const qs = new URLSearchParams({
    season: String(input.season),
    lastNGames: String(input.lastNGames)
  })
  return getJson<TitleOddsRow[]>(`/api/title-odds?${qs.toString()}`)
}

export function getPredictUpcoming(input: {
  season: number
  daysAhead: number
  lastNGames?: number
  h2hLastNGames?: number
}) {
  const qs = new URLSearchParams({
    season: String(input.season),
    daysAhead: String(input.daysAhead)
  })
  if (input.lastNGames != null) qs.set('lastNGames', String(input.lastNGames))
  if (input.h2hLastNGames != null) qs.set('h2hLastNGames', String(input.h2hLastNGames))
  return getJson<PredictUpcomingResponse>(`/api/predict-upcoming?${qs.toString()}`)
}

