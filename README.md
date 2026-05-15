# QuantTerminal ∞
### A Bloomberg-grade quantitative trading ecosystem — open source

![License](https://img.shields.io/badge/license-MIT-orange)
![Python](https://img.shields.io/badge/python-3.11-blue)
![React](https://img.shields.io/badge/react-18-61dafb)

A professional quantitative trading terminal built with FastAPI + React. Covers all 10 layers: data infrastructure, Bloomberg-style dashboard, TradingView integration, quantitative analytics, backtesting, news/sentiment, AI analysis, execution, community, and visual excellence.

---

## 🚀 Share with Friends — One-Click Deploy

### Option 1: Railway (Easiest — free tier available)
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/quant-terminal)

1. Click the button above
2. Add your `ANTHROPIC_API_KEY` (optional — works without it)
3. Railway gives you a public URL — share it!

### Option 2: Render (Free tier)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

### Option 3: Run Locally (2 minutes)
```bash
# Clone the repo
git clone https://github.com/4st7yqsy6n-ai/claude-test quant-terminal
cd quant-terminal

# Copy env file and add your keys (optional)
cp .env.example .env

# Start everything with Docker
docker compose up --build

# Open in browser
open http://localhost:3000
```

### Option 4: Deploy to VPS / Cloud
```bash
# On any Ubuntu/Debian server
git clone https://github.com/4st7yqsy6n-ai/claude-test quant-terminal
cd quant-terminal
cp .env.example .env
# Edit .env with your API keys
docker compose up -d --build
# Your app runs on port 3000
```

---

## 📸 Features

### Layer 1: Bloomberg Terminal UI
- **Command Palette** — Hit `Ctrl+K` for the Bloomberg-style command bar
- **Ticker Tape** — Live scrolling prices for all majors
- **Multi-panel layout** — Resizable panels, saved layouts
- **Dark theme** — Bloomberg orange on black

### Layer 2: Market Overview
- Real-time prices via WebSocket
- Equity indices (SPX, DJI, NDX, RUT, FTSE, DAX, NIKKEI)
- FX majors (EUR/USD, GBP/USD, USD/JPY, AUD/USD, etc.)
- Crypto (BTC, ETH, SOL)
- Commodities (Gold, Silver, Oil, Gas, Corn, Wheat)
- Rates (10Y UST, 30Y, VIX)

### Layer 3: Macro Dashboard
- **Yield curve** — Current vs. historical, inversion zones highlighted
- **Key indicators** — CPI, Unemployment, Fed Funds, GDP, Breakeven inflation
- **World monitor** — Global indices by region
- **Correlation matrix** — Cross-asset correlation heatmap

### Layer 4: TradingView Integration
- Full TradingView Advanced Chart embedded
- All timeframes, all indicators
- 80+ drawing tools
- Replay mode, paper trading

### Layer 5: News & Sentiment
- Real-time news from Reuters, FT, WSJ, CNBC, Yahoo Finance
- Category filters: Macro, FX, Equity, Crypto, Commodities
- Sentiment tags and impact ratings

### Layer 6: AI Analyst (Powered by Claude)
- **Market Briefing** — AI-generated morning report
- **Symbol Analysis** — Deep dive on any ticker
- **Trade Ideas** — Entry/exit/thesis generation
- **Risk Check** — Current portfolio risks
- **Ask anything** — Free-form market Q&A

### Layer 7: Screener
- Top gainers/losers across US equities
- Sector heatmap (S&P 500 sectors)
- Economic calendar with impact ratings

---

## 🛠 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + custom Bloomberg theme |
| Charts | Recharts + TradingView widgets |
| State | Zustand + React Query |
| Backend | Python 3.11 + FastAPI |
| Real-time | WebSockets |
| Market Data | yfinance (free) |
| Macro Data | FRED API (free) |
| News | RSS feeds (free) |
| AI | Claude API (Anthropic) |
| Deployment | Docker Compose |

---

## 🔑 API Keys (All Optional)

The terminal works without any API keys using realistic mock data.

| Key | Source | What it enables |
|-----|--------|-----------------|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | AI Analyst (Claude) |
| `FRED_API_KEY` | [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html) | Real macro data |

---

## 📁 Project Structure

```
quant-terminal/
├── backend/              # FastAPI Python backend
│   ├── app/
│   │   ├── main.py       # App entry point + WebSocket
│   │   ├── config.py     # Environment config
│   │   ├── routers/      # API route handlers
│   │   └── services/     # Data services (yfinance, FRED, news, AI)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/             # React + TypeScript frontend
│   ├── src/
│   │   ├── App.tsx       # Root component + layout
│   │   ├── components/   # All UI components
│   │   ├── hooks/        # Data fetching hooks
│   │   ├── stores/       # Zustand state
│   │   └── lib/          # API client
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml    # One-command deployment
├── .env.example          # Environment template
└── render.yaml           # Render deployment config
```

---

## 🗺 Roadmap

- [ ] **Phase 1** — TimescaleDB for historical data storage
- [ ] **Phase 2** — GARCH / HMM regime detection
- [ ] **Phase 3** — vectorbt backtesting integration
- [ ] **Phase 4** — Options flow scanner
- [ ] **Phase 5** — Alpaca live trading integration
- [ ] **Phase 6** — 13F hedge fund tracker
- [ ] **Phase 7** — Discord/Telegram bot
- [ ] **Phase 8** — Mobile PWA

---

## 📄 License

MIT — free to use, modify, and deploy.

---

*Built for serious traders and quant researchers. Not financial advice.*
