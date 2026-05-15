import axios from 'axios';
import type {
  MarketItem,
  OHLCVBar,
  YieldCurveData,
  MacroIndicator,
  NewsItem,
  AIAnalysis,
  ScreenerResult,
  SectorData,
  EconomicEvent,
  Timeframe,
} from '@/types';

// ─── Axios Instance ───────────────────────────────────────────────────────────

const api = axios.create({
  // Empty string = relative URLs (same host, combined deployment). Falls back to localhost for dev.
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Silently handle network errors - UI will show loading skeletons
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
      return Promise.reject(new Error('Backend unavailable'));
    }
    return Promise.reject(error);
  }
);

// ─── Mock Data Generators ─────────────────────────────────────────────────────

const generateSparkline = (base: number, count = 20): number[] => {
  const data = [base];
  for (let i = 1; i < count; i++) {
    const change = (Math.random() - 0.48) * base * 0.02;
    data.push(Math.max(0, data[i - 1] + change));
  }
  return data;
};

const MOCK_MARKET_DATA: MarketItem[] = [
  // Equity Indices
  { symbol: 'SPX', name: 'S&P 500', price: 5847.23, change: 24.56, change_pct: 0.42, volume: 2_340_000_000, category: 'index', sparkline: generateSparkline(5847) },
  { symbol: 'NDX', name: 'Nasdaq 100', price: 20_412.18, change: 142.33, change_pct: 0.70, volume: 1_890_000_000, category: 'index', sparkline: generateSparkline(20412) },
  { symbol: 'DJI', name: 'Dow Jones', price: 43_280.55, change: -87.23, change_pct: -0.20, volume: 890_000_000, category: 'index', sparkline: generateSparkline(43280) },
  { symbol: 'RUT', name: 'Russell 2000', price: 2_238.44, change: 18.92, change_pct: 0.85, volume: 420_000_000, category: 'index', sparkline: generateSparkline(2238) },
  { symbol: 'VIX', name: 'CBOE Volatility', price: 14.82, change: -0.64, change_pct: -4.14, category: 'index', sparkline: generateSparkline(14.82) },
  // FX
  { symbol: 'EURUSD', name: 'Euro / US Dollar', price: 1.0872, change: 0.0023, change_pct: 0.21, category: 'fx', sparkline: generateSparkline(1.0872) },
  { symbol: 'GBPUSD', name: 'British Pound / USD', price: 1.2734, change: -0.0041, change_pct: -0.32, category: 'fx', sparkline: generateSparkline(1.2734) },
  { symbol: 'USDJPY', name: 'USD / Japanese Yen', price: 149.82, change: 0.54, change_pct: 0.36, category: 'fx', sparkline: generateSparkline(149.82) },
  { symbol: 'USDCAD', name: 'USD / Canadian Dollar', price: 1.3621, change: -0.0012, change_pct: -0.09, category: 'fx', sparkline: generateSparkline(1.3621) },
  { symbol: 'AUDUSD', name: 'Australian Dollar / USD', price: 0.6521, change: 0.0034, change_pct: 0.52, category: 'fx', sparkline: generateSparkline(0.6521) },
  // Crypto
  { symbol: 'BTCUSD', name: 'Bitcoin / USD', price: 68_420.50, change: 1_234.50, change_pct: 1.84, volume: 28_400_000_000, market_cap: 1_345_000_000_000, category: 'crypto', sparkline: generateSparkline(68420) },
  { symbol: 'ETHUSD', name: 'Ethereum / USD', price: 3_842.10, change: -42.30, change_pct: -1.09, volume: 14_200_000_000, market_cap: 462_000_000_000, category: 'crypto', sparkline: generateSparkline(3842) },
  { symbol: 'SOLUSD', name: 'Solana / USD', price: 184.22, change: 8.44, change_pct: 4.81, category: 'crypto', sparkline: generateSparkline(184) },
  // Commodities
  { symbol: 'XAUUSD', name: 'Gold Spot / USD', price: 2_634.80, change: 12.40, change_pct: 0.47, category: 'commodity', sparkline: generateSparkline(2634) },
  { symbol: 'XAGUSD', name: 'Silver Spot / USD', price: 31.42, change: 0.28, change_pct: 0.90, category: 'commodity', sparkline: generateSparkline(31.42) },
  { symbol: 'USOIL', name: 'WTI Crude Oil', price: 72.84, change: -0.92, change_pct: -1.25, category: 'commodity', sparkline: generateSparkline(72.84) },
  { symbol: 'NATGAS', name: 'Natural Gas', price: 2.184, change: 0.034, change_pct: 1.58, category: 'commodity', sparkline: generateSparkline(2.184) },
  // Rates
  { symbol: 'US10Y', name: 'US 10Y Treasury', price: 4.285, change: 0.024, change_pct: 0.56, category: 'rate', sparkline: generateSparkline(4.285) },
  { symbol: 'US2Y', name: 'US 2Y Treasury', price: 4.612, change: -0.018, change_pct: -0.39, category: 'rate', sparkline: generateSparkline(4.612) },
  { symbol: 'US30Y', name: 'US 30Y Treasury', price: 4.482, change: 0.031, change_pct: 0.70, category: 'rate', sparkline: generateSparkline(4.482) },
];

const MOCK_MACRO: MacroIndicator[] = [
  { id: 'fed_funds', name: 'Fed Funds Rate', value: 5.50, previous: 5.50, change: 0, unit: '%', trend: 'flat', sentiment: 'neutral', description: 'Federal Reserve target rate' },
  { id: 'cpi_yoy', name: 'CPI YoY', value: 3.2, previous: 3.4, change: -0.2, unit: '%', trend: 'down', sentiment: 'positive', description: 'Consumer Price Index year-over-year' },
  { id: 'unemployment', name: 'Unemployment Rate', value: 3.9, previous: 3.8, change: 0.1, unit: '%', trend: 'up', sentiment: 'negative', description: 'US Unemployment Rate' },
  { id: 'gdp_qoq', name: 'GDP QoQ', value: 2.8, previous: 3.1, change: -0.3, unit: '%', trend: 'down', sentiment: 'neutral', description: 'GDP Quarter-over-Quarter annualized' },
  { id: 'us10y', name: '10Y Treasury', value: 4.285, previous: 4.261, change: 0.024, unit: '%', trend: 'up', sentiment: 'negative', description: '10-Year US Treasury Yield' },
  { id: 'spread_2s10s', name: '2s10s Spread', value: -0.327, previous: -0.350, change: 0.023, unit: '%', trend: 'up', sentiment: 'neutral', description: '10Y minus 2Y Treasury spread' },
  { id: 'breakeven_10y', name: '10Y Breakeven', value: 2.38, previous: 2.41, change: -0.03, unit: '%', trend: 'down', sentiment: 'positive', description: '10-Year Inflation Breakeven Rate' },
  { id: 'vix', name: 'VIX', value: 14.82, previous: 15.46, change: -0.64, unit: '', trend: 'down', sentiment: 'positive', description: 'CBOE Volatility Index' },
];

const MOCK_YIELD_CURVE: YieldCurveData = {
  current: [
    { maturity: '1M', maturity_months: 1, yield: 5.32, yield_1y_ago: 5.12 },
    { maturity: '3M', maturity_months: 3, yield: 5.38, yield_1y_ago: 5.21 },
    { maturity: '6M', maturity_months: 6, yield: 5.29, yield_1y_ago: 5.08 },
    { maturity: '1Y', maturity_months: 12, yield: 5.01, yield_1y_ago: 4.89 },
    { maturity: '2Y', maturity_months: 24, yield: 4.61, yield_1y_ago: 4.22 },
    { maturity: '5Y', maturity_months: 60, yield: 4.38, yield_1y_ago: 3.98 },
    { maturity: '7Y', maturity_months: 84, yield: 4.33, yield_1y_ago: 3.92 },
    { maturity: '10Y', maturity_months: 120, yield: 4.29, yield_1y_ago: 3.88 },
    { maturity: '20Y', maturity_months: 240, yield: 4.61, yield_1y_ago: 4.11 },
    { maturity: '30Y', maturity_months: 360, yield: 4.48, yield_1y_ago: 3.95 },
  ],
  as_of: new Date().toISOString(),
  inverted: true,
  spread_2s10s: -0.327,
};

const MOCK_NEWS: NewsItem[] = [
  { id: '1', headline: 'Fed Officials Signal No Rush to Cut Rates Amid Sticky Inflation Data', source: 'Reuters', published_at: new Date(Date.now() - 300_000).toISOString(), category: 'macro', sentiment: 'bearish', symbols: ['SPX', 'TLT'] },
  { id: '2', headline: 'NVIDIA Reports Record Q3 Revenue, Beats Estimates by Wide Margin', source: 'Bloomberg', published_at: new Date(Date.now() - 900_000).toISOString(), category: 'equity', sentiment: 'bullish', symbols: ['NVDA', 'NDX'], summary: 'NVIDIA Corporation reported record quarterly revenue driven by unprecedented demand for AI chips. The company beat analyst estimates by a wide margin and raised forward guidance.' },
  { id: '3', headline: 'Bitcoin Surges Past $68,000 as ETF Inflows Accelerate', source: 'CoinDesk', published_at: new Date(Date.now() - 1_800_000).toISOString(), category: 'crypto', sentiment: 'bullish', symbols: ['BTCUSD'] },
  { id: '4', headline: 'Dollar Weakens as Eurozone PMI Data Exceeds Expectations', source: 'FT', published_at: new Date(Date.now() - 3_600_000).toISOString(), category: 'fx', sentiment: 'bearish', symbols: ['EURUSD', 'DXY'] },
  { id: '5', headline: 'Oil Prices Slide on Weak Chinese Manufacturing Data', source: 'WSJ', published_at: new Date(Date.now() - 5_400_000).toISOString(), category: 'commodities', sentiment: 'bearish', symbols: ['USOIL'] },
  { id: '6', headline: 'US Jobs Report Surprises to Upside; Unemployment Ticks to 3.9%', source: 'BLS', published_at: new Date(Date.now() - 7_200_000).toISOString(), category: 'macro', sentiment: 'neutral', summary: 'The Bureau of Labor Statistics reported that the US economy added 256,000 jobs in September, exceeding expectations of 175,000. The unemployment rate edged up to 3.9%.' },
  { id: '7', headline: 'ECB Minutes Reveal Growing Concern Over Inflation Persistence', source: 'ECB', published_at: new Date(Date.now() - 10_800_000).toISOString(), category: 'macro', sentiment: 'bearish' },
  { id: '8', headline: 'Apple Unveils New AI Features, Shares Rise Pre-Market', source: 'CNBC', published_at: new Date(Date.now() - 14_400_000).toISOString(), category: 'equity', sentiment: 'bullish', symbols: ['AAPL'] },
];

const MOCK_ECONOMIC_EVENTS: EconomicEvent[] = [
  { id: '1', datetime: new Date(Date.now() + 3_600_000).toISOString(), event: 'FOMC Meeting Minutes', country: 'United States', country_code: 'US', impact: 'high', forecast: '', previous: '', currency: 'USD' },
  { id: '2', datetime: new Date(Date.now() + 86_400_000).toISOString(), event: 'Initial Jobless Claims', country: 'United States', country_code: 'US', impact: 'medium', forecast: '225K', previous: '231K', currency: 'USD' },
  { id: '3', datetime: new Date(Date.now() + 172_800_000).toISOString(), event: 'Non-Farm Payrolls', country: 'United States', country_code: 'US', impact: 'high', forecast: '185K', previous: '256K', currency: 'USD' },
  { id: '4', datetime: new Date(Date.now() + 172_900_000).toISOString(), event: 'Unemployment Rate', country: 'United States', country_code: 'US', impact: 'high', forecast: '3.9%', previous: '3.9%', currency: 'USD' },
  { id: '5', datetime: new Date(Date.now() + 259_200_000).toISOString(), event: 'CPI MoM', country: 'United States', country_code: 'US', impact: 'high', forecast: '0.3%', previous: '0.2%', currency: 'USD' },
  { id: '6', datetime: new Date(Date.now() + 259_300_000).toISOString(), event: 'ECB Interest Rate Decision', country: 'European Union', country_code: 'EU', impact: 'high', forecast: '4.00%', previous: '4.25%', currency: 'EUR' },
  { id: '7', datetime: new Date(Date.now() + 345_600_000).toISOString(), event: 'Retail Sales MoM', country: 'United States', country_code: 'US', impact: 'medium', forecast: '0.4%', previous: '-0.2%', currency: 'USD' },
  { id: '8', datetime: new Date(Date.now() - 3_600_000).toISOString(), event: 'ISM Manufacturing PMI', country: 'United States', country_code: 'US', impact: 'medium', actual: '49.1', forecast: '49.8', previous: '47.2', currency: 'USD' },
];

// ─── API Functions ────────────────────────────────────────────────────────────

export async function fetchMarketOverview(): Promise<MarketItem[]> {
  try {
    const response = await api.get<MarketItem[]>('/api/market/overview');
    return response.data;
  } catch {
    return MOCK_MARKET_DATA;
  }
}

export async function fetchOHLCV(symbol: string, _timeframe: Timeframe = '1D'): Promise<OHLCVBar[]> {
  try {
    const response = await api.get<OHLCVBar[]>(`/api/market/ohlcv/${symbol}`);
    return response.data;
  } catch {
    // Return empty - TradingView widget handles its own data
    return [];
  }
}

export async function fetchYieldCurve(): Promise<YieldCurveData> {
  try {
    const response = await api.get<YieldCurveData>('/api/macro/yield-curve');
    return response.data;
  } catch {
    return MOCK_YIELD_CURVE;
  }
}

export async function fetchMacroIndicators(): Promise<MacroIndicator[]> {
  try {
    const response = await api.get<MacroIndicator[]>('/api/macro/indicators');
    return response.data;
  } catch {
    return MOCK_MACRO;
  }
}

export async function fetchNews(category?: string): Promise<NewsItem[]> {
  try {
    const params = category && category !== 'all' ? { category } : {};
    const response = await api.get<NewsItem[]>('/api/news', { params });
    return response.data;
  } catch {
    if (category && category !== 'all') {
      return MOCK_NEWS.filter((n) => n.category === category);
    }
    return MOCK_NEWS;
  }
}

export async function analyzeSymbol(symbol: string): Promise<AIAnalysis> {
  const response = await api.post<AIAnalysis>('/api/ai/analyze', { symbol });
  return response.data;
}

export async function askAI(message: string, history: Array<{ role: string; content: string }>): Promise<string> {
  const response = await api.post<{ response: string }>('/api/ai/chat', {
    message,
    history,
  });
  return response.data.response;
}

export async function getScreenerMovers(type: 'gainers' | 'losers' = 'gainers'): Promise<ScreenerResult[]> {
  try {
    const response = await api.get<ScreenerResult[]>(`/api/screener/movers?type=${type}`);
    return response.data;
  } catch {
    const mockMovers: ScreenerResult[] = [
      { symbol: 'NVDA', name: 'NVIDIA Corp', price: 875.40, change: 52.30, change_pct: type === 'gainers' ? 6.35 : -6.35, volume: 42_000_000, market_cap: 2_150_000_000_000, sector: 'Technology' },
      { symbol: 'META', name: 'Meta Platforms', price: 582.14, change: 28.44, change_pct: type === 'gainers' ? 5.14 : -5.14, volume: 18_000_000, market_cap: 1_480_000_000_000, sector: 'Technology' },
      { symbol: 'TSLA', name: 'Tesla Inc', price: 248.70, change: 11.20, change_pct: type === 'gainers' ? 4.72 : -4.72, volume: 95_000_000, market_cap: 792_000_000_000, sector: 'Consumer Disc.' },
      { symbol: 'AMD', name: 'Advanced Micro Devices', price: 162.33, change: 6.88, change_pct: type === 'gainers' ? 4.42 : -4.42, volume: 52_000_000, market_cap: 262_000_000_000, sector: 'Technology' },
      { symbol: 'AMZN', name: 'Amazon.com Inc', price: 195.80, change: 7.30, change_pct: type === 'gainers' ? 3.87 : -3.87, volume: 34_000_000, market_cap: 2_020_000_000_000, sector: 'Consumer Disc.' },
      { symbol: 'AAPL', name: 'Apple Inc', price: 229.40, change: 5.80, change_pct: type === 'gainers' ? 2.59 : -2.59, volume: 60_000_000, market_cap: 3_450_000_000_000, sector: 'Technology' },
      { symbol: 'MSFT', name: 'Microsoft Corp', price: 442.50, change: 8.20, change_pct: type === 'gainers' ? 1.89 : -1.89, volume: 22_000_000, market_cap: 3_280_000_000_000, sector: 'Technology' },
      { symbol: 'GOOGL', name: 'Alphabet Inc', price: 181.20, change: 2.84, change_pct: type === 'gainers' ? 1.59 : -1.59, volume: 25_000_000, market_cap: 2_250_000_000_000, sector: 'Technology' },
    ];
    return mockMovers;
  }
}

export async function getHeatmapData(): Promise<SectorData[]> {
  try {
    const response = await api.get<SectorData[]>('/api/screener/heatmap');
    return response.data;
  } catch {
    return [
      { name: 'Technology', change_pct: 1.24, weight: 29.2 },
      { name: 'Healthcare', change_pct: -0.38, weight: 12.8 },
      { name: 'Financials', change_pct: 0.72, weight: 12.5 },
      { name: 'Consumer Disc.', change_pct: 0.91, weight: 10.4 },
      { name: 'Industrials', change_pct: -0.14, weight: 8.9 },
      { name: 'Communication', change_pct: 1.82, weight: 8.6 },
      { name: 'Consumer Staples', change_pct: -0.22, weight: 6.0 },
      { name: 'Energy', change_pct: -1.54, weight: 4.2 },
      { name: 'Utilities', change_pct: 0.44, weight: 2.5 },
      { name: 'Real Estate', change_pct: -0.88, weight: 2.4 },
      { name: 'Materials', change_pct: 0.33, weight: 2.5 },
    ];
  }
}

export async function getEconomicCalendar(): Promise<EconomicEvent[]> {
  try {
    const response = await api.get<EconomicEvent[]>('/api/calendar');
    return response.data;
  } catch {
    return MOCK_ECONOMIC_EVENTS;
  }
}

export default api;
