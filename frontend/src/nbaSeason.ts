/** Ano da temporada na Balldontlie (início em ~outubro). */
export function nbaSeasonStartYear(d = new Date()): number {
  const y = d.getFullYear()
  const m = d.getMonth()
  return m >= 9 ? y : y - 1
}
