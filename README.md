# 🏀 ClutchPredictor

Preditor de jogos NBA com modelo ELO que estima probabilidades de vitória e chances de título.

## ⚠️ Limite de uso da API

O sistema agora utiliza a [TheRundown API](https://therundown.io/) no plano gratuito, que permite **20.000 data points/dia** e 1 requisição por segundo. Se esse limite for atingido, a API ficará bloqueada até o próximo dia.

**Dicas para evitar bloqueio:**
- O app só faz requisição quando você clica em "Atualizar".
- O padrão é buscar apenas 1 dia de jogos futuros.
- Evite clicar repetidamente ou aumentar muito o número de dias.

## ✨ Funcionalidades

- **Previsão de Jogos**: Probabilidade de vitória baseada em desempenho recente (ELO)
- **Odds de Título**: Probabilidade simplificada de cada equipe conquistar o título
- **Dados em Tempo Real**: Integração com TheRundown API (ou balldontlie, opcional)

## 🛠️ Tech Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | React + TypeScript + Vite |
| Backend | Express + TypeScript |
| Modelo | ELO Rating System |
| Dados | TheRundown API (default) ou balldontlie |

## 🚀 Como rodar

```bash
# Instalar dependências
npm install
cd backend && npm install
cd ../frontend && npm install

# Iniciar desenvolvimento
npm run dev

# Configuração de ambiente

1. Crie o arquivo `.env` dentro da pasta `backend` (ou copie `.env.example`)
2. Obtenha uma chave gratuita em https://therundown.io/pricing/api
3. Preencha no `.env`:

```
THERUNDOWN_API_KEY=sua_api_key_aqui
DATA_PROVIDER=therundown
```
```

- **Backend**: http://127.0.0.1:3001
- **Frontend**: http://127.0.0.1:5173

## 📡 Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/health` | Health check |
| GET | `/api/predict` | Prever resultado de um jogo |
| GET | `/api/title-odds` | Odds de título por equipe |
| GET | `/api/predict-upcoming` | Jogos futuros + probabilidades |

### Exemplo de uso

```bash
# Prever jogo: Lakers vs Celtics
curl "http://localhost:3001/api/predict?homeTeamAbbr=LAL&awayTeamAbbr=BOS&season=2026&lastNGames=12&h2hLastNGames=6"

# Odds de título
curl "http://localhost:3001/api/title-odds?season=2026&lastNGames=16"

# Jogos futuros (com probabilidades)
curl "http://localhost:3001/api/predict-upcoming?season=2026&daysAhead=1"
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
