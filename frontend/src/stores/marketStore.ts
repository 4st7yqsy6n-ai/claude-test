import { create } from 'zustand';
import type { LivePrices } from '@/types';

interface MarketState {
  watchlist: string[];
  selectedSymbol: string;
  liveprices: LivePrices;
  priceFlash: Record<string, 'up' | 'down' | null>;

  // Actions
  setSelectedSymbol: (symbol: string) => void;
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  updateLivePrice: (symbol: string, price: number, change: number, change_pct: number) => void;
  bulkUpdatePrices: (prices: LivePrices) => void;
  clearFlash: (symbol: string) => void;
}

const DEFAULT_WATCHLIST = ['AAPL', 'MSFT', 'NVDA', 'META', 'AMZN', 'GOOGL', 'TSLA', 'SPY', 'QQQ', 'GLD'];

// Seed initial prices
const INITIAL_PRICES: LivePrices = {
  SPX:    { price: 5847.23,  change: 24.56,   change_pct: 0.42  },
  NDX:    { price: 20412.18, change: 142.33,  change_pct: 0.70  },
  DJI:    { price: 43280.55, change: -87.23,  change_pct: -0.20 },
  VIX:    { price: 14.82,    change: -0.64,   change_pct: -4.14 },
  AAPL:   { price: 229.40,   change: 5.80,    change_pct: 2.59  },
  MSFT:   { price: 442.50,   change: 8.20,    change_pct: 1.89  },
  NVDA:   { price: 875.40,   change: 52.30,   change_pct: 6.35  },
  META:   { price: 582.14,   change: 28.44,   change_pct: 5.14  },
  AMZN:   { price: 195.80,   change: 7.30,    change_pct: 3.87  },
  GOOGL:  { price: 181.20,   change: 2.84,    change_pct: 1.59  },
  TSLA:   { price: 248.70,   change: 11.20,   change_pct: 4.72  },
  SPY:    { price: 584.72,   change: 2.46,    change_pct: 0.42  },
  QQQ:    { price: 495.30,   change: 3.45,    change_pct: 0.70  },
  GLD:    { price: 242.80,   change: 1.14,    change_pct: 0.47  },
  EURUSD: { price: 1.0872,   change: 0.0023,  change_pct: 0.21  },
  GBPUSD: { price: 1.2734,   change: -0.0041, change_pct: -0.32 },
  USDJPY: { price: 149.82,   change: 0.54,    change_pct: 0.36  },
  BTCUSD: { price: 68420.50, change: 1234.50, change_pct: 1.84  },
  ETHUSD: { price: 3842.10,  change: -42.30,  change_pct: -1.09 },
  XAUUSD: { price: 2634.80,  change: 12.40,   change_pct: 0.47  },
  USOIL:  { price: 72.84,    change: -0.92,   change_pct: -1.25 },
  US10Y:  { price: 4.285,    change: 0.024,   change_pct: 0.56  },
  US2Y:   { price: 4.612,    change: -0.018,  change_pct: -0.39 },
};

export const useMarketStore = create<MarketState>((set, get) => ({
  watchlist: DEFAULT_WATCHLIST,
  selectedSymbol: 'AAPL',
  liveprices: INITIAL_PRICES,
  priceFlash: {},

  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),

  addToWatchlist: (symbol) => {
    const { watchlist } = get();
    if (!watchlist.includes(symbol)) {
      set({ watchlist: [...watchlist, symbol] });
    }
  },

  removeFromWatchlist: (symbol) => {
    set({ watchlist: get().watchlist.filter((s) => s !== symbol) });
  },

  updateLivePrice: (symbol, price, change, change_pct) => {
    const existing = get().liveprices[symbol];
    const direction = existing ? (price > existing.price ? 'up' : price < existing.price ? 'down' : null) : null;

    set((state) => ({
      liveprices: {
        ...state.liveprices,
        [symbol]: { price, change, change_pct, timestamp: Date.now() },
      },
      priceFlash: {
        ...state.priceFlash,
        [symbol]: direction,
      },
    }));

    // Clear flash after 600ms
    if (direction) {
      setTimeout(() => {
        get().clearFlash(symbol);
      }, 600);
    }
  },

  bulkUpdatePrices: (prices) => {
    set((state) => ({
      liveprices: { ...state.liveprices, ...prices },
    }));
  },

  clearFlash: (symbol) => {
    set((state) => ({
      priceFlash: { ...state.priceFlash, [symbol]: null },
    }));
  },
}));
