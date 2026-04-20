/** Balldontlie `season` = ano em que a temporada NBA começa (out ~set do ano seguinte). */
export function nbaSeasonStartYearFromDate(d = new Date()): number {
  const y = d.getFullYear();
  const m = d.getMonth();
  return m >= 9 ? y : y - 1;
}

/** Evita temporada errada quando o usuário usa o ano civil (ex.: 2026 em abril = temporada 2025–26 → API 2025). */
export function normalizeBalldontlieSeason(requested: number, ref = new Date()): number {
  const cur = nbaSeasonStartYearFromDate(ref);
  const cal = ref.getFullYear();
  if (requested === cal && requested > cur) return cur;
  if (requested < 1946) return cur;
  if (requested > cur + 1) return cur + 1;
  return requested;
}
