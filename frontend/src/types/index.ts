// ─── Market Data Types ────────────────────────────────────────────────────────

export interface MarketItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_pct: number;
  volume?: number;
  market_cap?: number;
  high_24h?: number;
  low_24h?: number;
  sparkline?: number[];
  sector?: string;
  category: 'equity' | 'fx' | 'crypto' | 'commodity' | 'index' | 'rate';
}

export interface OHLCVBar {
  time: number; // unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LivePrice {
  price: number;
  change: number;
  change_pct: number;
  timestamp?: number;
}

export interface LivePrices {
  [symbol: string]: LivePrice;
}

// ─── Macro & Rates Types ──────────────────────────────────────────────────────

export interface MacroIndicator {
  id: string;
  name: string;
  value: number;
  previous?: number;
  change?: number;
  unit: string;
  description?: string;
  source?: string;
  updated_at?: string;
  trend: 'up' | 'down' | 'flat';
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface YieldPoint {
  maturity: string;
  maturity_months: number;
  yield: number;
  yield_1y_ago?: number;
}

export interface YieldCurveData {
  current: YieldPoint[];
  historical?: YieldPoint[];
  as_of?: string;
  inverted?: boolean;
  spread_2s10s?: number;
}

// ─── News Types ───────────────────────────────────────────────────────────────

export type NewsCategory = 'macro' | 'fx' | 'equity' | 'crypto' | 'rates' | 'commodities' | 'general';

export interface NewsItem {
  id: string;
  headline: string;
  summary?: string;
  source: string;
  url?: string;
  published_at: string;
  category: NewsCategory;
  symbols?: string[];
  sentiment?: 'bullish' | 'bearish' | 'neutral';
}

// ─── Screener Types ───────────────────────────────────────────────────────────

export interface ScreenerResult {
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_pct: number;
  volume: number;
  avg_volume?: number;
  market_cap?: number;
  pe_ratio?: number;
  sector?: string;
}

export interface SectorData {
  name: string;
  change_pct: number;
  market_cap?: number;
  weight?: number; // % of S&P 500
  color?: string;
}

// ─── Economic Calendar Types ──────────────────────────────────────────────────

export type ImpactLevel = 'high' | 'medium' | 'low';

export interface EconomicEvent {
  id: string;
  datetime: string;
  event: string;
  country: string;
  country_code: string;
  actual?: string;
  forecast?: string;
  previous?: string;
  impact: ImpactLevel;
  currency?: string;
}

// ─── AI Types ─────────────────────────────────────────────────────────────────

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

export interface AIAnalysis {
  symbol: string;
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  key_levels: {
    support: number[];
    resistance: number[];
  };
  risks: string[];
  opportunities: string[];
  recommendation: string;
}

// ─── World Monitor Types ──────────────────────────────────────────────────────

export interface GlobalIndex {
  symbol: string;
  name: string;
  country: string;
  flag: string;
  region: 'americas' | 'europe' | 'asia-pacific';
  price: number;
  change: number;
  change_pct: number;
}

// ─── Heatmap Types ────────────────────────────────────────────────────────────

export interface HeatmapCell {
  symbol: string;
  name: string;
  change_pct: number;
  market_cap?: number;
  volume?: number;
}

// ─── WebSocket Types ──────────────────────────────────────────────────────────

export interface WSMessage {
  type: 'price_update' | 'news' | 'alert' | 'heartbeat';
  data: WSPriceUpdate | NewsItem | unknown;
  timestamp: number;
}

export interface WSPriceUpdate {
  symbol: string;
  price: number;
  change: number;
  change_pct: number;
}

// ─── Command Palette Types ────────────────────────────────────────────────────

export interface Command {
  id: string;
  label: string;
  description?: string;
  category: 'navigation' | 'market' | 'symbol' | 'action';
  action: () => void;
  icon?: string;
  shortcut?: string;
}

// ─── Chart Types ──────────────────────────────────────────────────────────────

export type Timeframe = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '5Y';

export interface ChartConfig {
  symbol: string;
  timeframe: Timeframe;
  chartType: 'candlestick' | 'line' | 'area';
  indicators: string[];
}
