import { useCallback, useEffect, useState } from 'react'
import {
  ALL_TEAMS,
  type PredictResult,
  type TeamAbbr,
  type TitleOddsRow,
  type UpcomingGame,
  getPredictUpcoming,
  getTitleOdds,
  predictMatchup
} from './api'
import './App.css'
import { nbaSeasonStartYear } from './nbaSeason'

type Screen = 'confronto' | 'proximos'

function App() {
  const [screen, setScreen] = useState<Screen>('confronto')
  const [season, setSeason] = useState(() => nbaSeasonStartYear())
  const [homeTeamAbbr, setHomeTeamAbbr] = useState<TeamAbbr>('BOS')
  const [awayTeamAbbr, setAwayTeamAbbr] = useState<TeamAbbr>('LAL')
  const [lastNGames, setLastNGames] = useState(12)
  const [h2hLastNGames, setH2hLastNGames] = useState(6)

  const [predictLoading, setPredictLoading] = useState(false)
  const [titleLoading, setTitleLoading] = useState(false)
  const [predictError, setPredictError] = useState<string | null>(null)
  const [titleError, setTitleError] = useState<string | null>(null)

  const [prediction, setPrediction] = useState<PredictResult | null>(null)
  const [titleOdds, setTitleOdds] = useState<TitleOddsRow[] | null>(null)

  const [daysAhead, setDaysAhead] = useState(7)
  const [upcomingLoading, setUpcomingLoading] = useState(false)
  const [upcomingError, setUpcomingError] = useState<string | null>(null)
  const [upcomingRows, setUpcomingRows] = useState<Array<{ game: UpcomingGame; pred: PredictResult }>>([])

  const canPredict = homeTeamAbbr !== awayTeamAbbr

  const loadTitleOdds = useCallback(async () => {
    setTitleLoading(true)
    setTitleError(null)
    try {
      const res = await getTitleOdds({ season, lastNGames: 16 })
      setTitleOdds(res)
    } catch (e) {
      setTitleError(e instanceof Error ? e.message : String(e))
    } finally {
      setTitleLoading(false)
    }
  }, [season])

  useEffect(() => {
    void loadTitleOdds()
  }, [loadTitleOdds])

  async function onPredict() {
    if (!canPredict) return
    setPredictLoading(true)
    setPredictError(null)
    try {
      const res = await predictMatchup({ homeTeamAbbr, awayTeamAbbr, season, lastNGames, h2hLastNGames })
      setPrediction(res)
    } catch (e) {
      setPredictError(e instanceof Error ? e.message : String(e))
    } finally {
      setPredictLoading(false)
    }
  }

  async function onLoadUpcoming() {
    setUpcomingLoading(true)
    setUpcomingError(null)
    try {
      const res = await getPredictUpcoming({
        season,
        daysAhead,
        lastNGames,
        h2hLastNGames
      })
      const games = res.games ?? []
      const rows = games
        .map((game, i) => {
          const pred = res.predictions[i]
          if (!pred) return null
          return { game, pred }
        })
        .filter((x): x is { game: UpcomingGame; pred: PredictResult } => x != null)
      setUpcomingRows(rows)
    } catch (e) {
      setUpcomingError(e instanceof Error ? e.message : String(e))
      setUpcomingRows([])
    } finally {
      setUpcomingLoading(false)
    }
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <div className="kicker">NBA · temporada {season}</div>
          <h1>ClutchPredictor</h1>
          <p className="sub">
            Probabilidades de vitória por confronto e chances de título (MVP: modelo inicial Elo + forma recente +
            H2H).
          </p>
        </div>
        <nav className="nav" aria-label="Navegação principal">
          <button type="button" className={screen === 'confronto' ? 'navTab active' : 'navTab'} onClick={() => setScreen('confronto')}>
            Confronto
          </button>
          <button type="button" className={screen === 'proximos' ? 'navTab active' : 'navTab'} onClick={() => setScreen('proximos')}>
            Próximos jogos
          </button>
        </nav>
      </header>

      {screen === 'confronto' ? (
        <main className="grid">
          <section className="card">
            <h2>Prever confronto</h2>
            <div className="row">
              <label>
                <div className="label">Temporada (ano de início, ex. 2025 → 2025–26)</div>
                <input type="number" value={season} onChange={(e) => setSeason(Number(e.target.value))} min={1946} />
              </label>
              <label>
                <div className="label">Últimos jogos (forma)</div>
                <input
                  type="number"
                  value={lastNGames}
                  onChange={(e) => setLastNGames(Number(e.target.value))}
                  min={1}
                  max={40}
                />
              </label>
              <label>
                <div className="label">H2H (últimos)</div>
                <input
                  type="number"
                  value={h2hLastNGames}
                  onChange={(e) => setH2hLastNGames(Number(e.target.value))}
                  min={0}
                  max={20}
                />
              </label>
            </div>

            <div className="row">
              <label>
                <div className="label">Casa</div>
                <select value={homeTeamAbbr} onChange={(e) => setHomeTeamAbbr(e.target.value as TeamAbbr)}>
                  {ALL_TEAMS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <div className="label">Visitante</div>
                <select value={awayTeamAbbr} onChange={(e) => setAwayTeamAbbr(e.target.value as TeamAbbr)}>
                  {ALL_TEAMS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <div className="actions">
                <button disabled={!canPredict || predictLoading} onClick={onPredict}>
                  {predictLoading ? 'Calculando…' : 'Prever'}
                </button>
                {!canPredict ? <div className="hint">Escolha times diferentes.</div> : null}
              </div>
            </div>

            {predictError ? <div className="error">Erro: {predictError}</div> : null}

            {prediction ? (
              <div className="result">
                <div className="big">
                  <div className="pill">
                    {prediction.homeTeamAbbr} vencer: <strong>{(prediction.winProbHome * 100).toFixed(1)}%</strong>
                  </div>
                  <div className="pill">
                    {prediction.awayTeamAbbr} vencer: <strong>{(prediction.winProbAway * 100).toFixed(1)}%</strong>
                  </div>
                </div>
                <div className="meta metaWrap">
                  <div>Rating casa: {prediction.model.homeRating.toFixed(0)}</div>
                  <div>Rating fora: {prediction.model.awayRating.toFixed(0)}</div>
                  <div>Ajuste H2H: {prediction.model.h2hAdjustment.toFixed(0)}</div>
                  {prediction.model.homeCourtAdvantage != null ? (
                    <div>Mando (Elo): +{prediction.model.homeCourtAdvantage.toFixed(0)}</div>
                  ) : null}
                  {prediction.model.injuryAdjustmentHome != null ? (
                    <div>Lesões casa (esperado): {prediction.model.injuryAdjustmentHome.toFixed(0)}</div>
                  ) : null}
                  {prediction.model.injuryAdjustmentAway != null ? (
                    <div>Lesões fora (esperado): {prediction.model.injuryAdjustmentAway.toFixed(0)}</div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="empty">Faça uma previsão para ver as porcentagens.</div>
            )}
          </section>

          <section className="card">
            <div className="titleRow">
              <div>
                <h2>Ranking da temporada</h2>
                <p className="cardHint">Ordem estática por modelo (todos os times). Atualiza ao mudar a temporada ou ao recarregar.</p>
              </div>
              <button disabled={titleLoading} onClick={() => void loadTitleOdds()}>
                {titleLoading ? 'Carregando…' : 'Atualizar'}
              </button>
            </div>
            {titleError ? <div className="error">Erro: {titleError}</div> : null}

            {titleOdds && titleOdds.length > 0 ? (
              <ol className="list rankScroll" start={1}>
                {titleOdds.map((r, idx) => (
                  <li key={r.teamAbbr} className="listItem">
                    <span className="rankNum">{idx + 1}</span>
                    <span className="team">{r.teamAbbr}</span>
                    <span className="prob">{(r.titleProb * 100).toFixed(2)}%</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="empty">{titleLoading ? 'Carregando ranking…' : 'Sem dados ainda.'}</div>
            )}
          </section>
        </main>
      ) : (
        <main className="single">
          <section className="card">
            <h2>Próximos jogos</h2>
            <p className="cardHint">
              Lista de partidas nos próximos dias com probabilidade de vitória (casa × visitante), usando os mesmos
              parâmetros de forma e H2H.
            </p>
            <div className="row row4">
              <label>
                <div className="label">Temporada (ano de início na API)</div>
                <input type="number" value={season} onChange={(e) => setSeason(Number(e.target.value))} min={1946} />
              </label>
              <label>
                <div className="label">Próximos (dias)</div>
                <input type="number" value={daysAhead} onChange={(e) => setDaysAhead(Number(e.target.value))} min={1} max={14} />
              </label>
              <label>
                <div className="label">Últimos jogos (forma)</div>
                <input type="number" value={lastNGames} onChange={(e) => setLastNGames(Number(e.target.value))} min={1} max={40} />
              </label>
              <label>
                <div className="label">H2H (últimos)</div>
                <input type="number" value={h2hLastNGames} onChange={(e) => setH2hLastNGames(Number(e.target.value))} min={0} max={20} />
              </label>
            </div>
            <div className="actionsRow">
              <button type="button" disabled={upcomingLoading} onClick={() => void onLoadUpcoming()}>
                {upcomingLoading ? 'Carregando…' : 'Carregar jogos'}
              </button>
            </div>
            {upcomingError ? <div className="error">Erro: {upcomingError}</div> : null}
            {upcomingRows.length > 0 ? (
              <div className="tableWrap">
                <table className="upcomingTable">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Casa</th>
                      <th>Visitante</th>
                      <th>P (casa)</th>
                      <th>P (fora)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingRows.map(({ game, pred }) => (
                      <tr key={game.id}>
                        <td className="dt">{new Date(game.dateISO).toLocaleString()}</td>
                        <td>
                          <span className="teamTag home">{game.homeTeamAbbr}</span>
                        </td>
                        <td>
                          <span className="teamTag away">{game.awayTeamAbbr}</span>
                        </td>
                        <td className="num">{(pred.winProbHome * 100).toFixed(1)}%</td>
                        <td className="num">{(pred.winProbAway * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !upcomingLoading ? (
              <div className="empty">Clique em “Carregar jogos”. Em modo mock aparecem jogos sintéticos; com API real use DATA_PROVIDER=balldontlie.</div>
            ) : null}
          </section>
        </main>
      )}

      <footer className="footer">
        <span>
          Backend: use <code>DATA_PROVIDER=balldontlie</code> e <code>BALLDONTLIE_API_KEY</code> para dados reais;
          sem isso, o mock gera agenda e placares fictícios.
        </span>
      </footer>
    </div>
  )
}

export default App
