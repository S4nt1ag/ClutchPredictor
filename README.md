# 🏀 ClutchPredictor

Preditor de jogos NBA com modelo ELO que estima probabilidades de vitória e chances de título.

## ✨ Funcionalidades

- **Previsão de Jogos**: Probabilidade de vitória baseada em desempenho recente (ELO)
- **Odds de Título**: Probabilidade simplificada de cada equipe conquistar o título
- **Dados em Tempo Real**: Integração com API da NBA (balldontlie)

## 🛠️ Tech Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | React + TypeScript + Vite |
| Backend | Express + TypeScript |
| Modelo | ELO Rating System |
| Dados | balldontlie API |

## 🚀 Como rodar

```bash
# Instalar dependências
npm install
cd backend && npm install
cd ../frontend && npm install

# Iniciar desenvolvimento
npm run dev
```

- **Backend**: http://127.0.0.1:3001
- **Frontend**: http://127.0.0.1:5173

## 📡 Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/health` | Health check |
| GET | `/api/predict` | Prever resultado de um jogo |
| GET | `/api/title-odds` | Odds de título por equipe |

### Exemplo de uso

```bash
# Prever jogo: Lakers vs Celtics
curl "http://localhost:3001/api/predict?homeTeamAbbr=LAL&awayTeamAbbr=BOS&season=2026&lastNGames=12&h2hLastNGames=6"

# Odds de título
curl "http://localhost:3001/api/title-odds?season=2026&lastNGames=16"
```

## 📁 Estrutura

```
ClutchPredictor/
├── backend/          # API REST em Express
│   ├── src/
│   │   ├── model/    # Algoritmo ELO
│   │   ├── service/  # Lógica de predição
│   │   └── data/     # Providers (mock/real)
└── frontend/         # UI em React
    └── src/
```

## 📝 Licença

MIT
