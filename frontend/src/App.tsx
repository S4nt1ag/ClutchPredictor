import { useEffect, useState } from 'react'
import {
  type PredictResult,
  type UpcomingGame,
  getPredictUpcoming
} from './api'
import './App.css'
import { nbaSeasonStartYear } from './nbaSeason'

function App() {
  // Sempre usar a temporada atual
  const season = nbaSeasonStartYear()
  const [lastNGames, setLastNGames] = useState(12)
  const [h2hLastNGames, setH2hLastNGames] = useState(6)

  const [daysAhead, setDaysAhead] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Array<{ game: UpcomingGame; pred: PredictResult }>>([])

  async function loadGames() {
    setLoading(true)
    setError(null)
    try {
      const res = await getPredictUpcoming({
        season,
        daysAhead,
        lastNGames,
        h2hLastNGames
      })
      const games = res.games ?? []
      const mapped = games
        .map((game, i) => {
          const pred = res.predictions[i]
          if (!pred) return null
          return { game, pred }
        })
        .filter((x): x is { game: UpcomingGame; pred: PredictResult } => x != null)
      setRows(mapped)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="page">
      <header className="header">
        <div>
          <div className="kicker">NBA</div>
          <h1>ClutchPredictor</h1>
          <p className="sub">
            Probabilidades de vitória.
          </p>
        </div>
      </header>

      <main className="single">
        <section className="card">
          <h2>Próximos jogos</h2>
          <div className="row row4">
            <label>
              <div className="label">Próximos (dias)</div>
              <input 
                type="number" 
                value={daysAhead} 
                onChange={(e) => setDaysAhead(Number(e.target.value))} 
                min={1} 
                max={14} 
              />
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
            <div className="actions">
              <button type="button" disabled={loading} onClick={() => void loadGames()}>
                {loading ? 'Carregando…' : 'Atualizar'}
              </button>
            </div>
          </div>

          {error ? <div className="error">Erro: {error}</div> : null}

          {rows.length > 0 ? (
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
                  {rows.map(({ game, pred }) => (
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
          ) : !loading ? (
            <div className="empty">Clique em "Atualizar" para carregar os jogos.</div>
          ) : null}
        </section>
      </main>

      <footer className="footer">
        <span>
          Backend: use <code>DATA_PROVIDER=therundown</code> e <code>THERUNDOWN_API_KEY</code> para dados reais.
        </span>
      </footer>
    </div>
  )
}

export default App
