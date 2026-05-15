import { useState, useRef, useEffect } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import clsx from 'clsx';
import type { Timeframe } from '@/types';

const TIMEFRAMES: Timeframe[] = ['1D', '1W', '1M', '3M', '1Y', '5Y'];

const TIMEFRAME_TV_MAP: Record<Timeframe, string> = {
  '1D': 'D',
  '1W': 'W',
  '1M': 'M',
  '3M': '3M',
  '1Y': '12M',
  '5Y': '60M',
};

function buildTVUrl(symbol: string, timeframe: Timeframe): string {
  // Map common symbols to TradingView format
  const tvSymbol = (() => {
    const map: Record<string, string> = {
      'SPX': 'SP:SPX',
      'NDX': 'NASDAQ:NDX',
      'DJI': 'DJ:DJI',
      'EURUSD': 'FX:EURUSD',
      'GBPUSD': 'FX:GBPUSD',
      'USDJPY': 'FX:USDJPY',
      'BTCUSD': 'BINANCE:BTCUSDT',
      'ETHUSD': 'BINANCE:ETHUSDT',
      'XAUUSD': 'OANDA:XAUUSD',
      'USOIL': 'NYMEX:CL1!',
      'US10Y': 'TVC:US10Y',
      'US2Y': 'TVC:US02Y',
      'VIX': 'TVC:VIX',
    };
    return map[symbol] ?? `NASDAQ:${symbol}`;
  })();

  const interval = TIMEFRAME_TV_MAP[timeframe] ?? 'D';

  return `https://www.tradingview.com/widgetsnext/embed/advanced-chart/?symbol=${encodeURIComponent(tvSymbol)}&interval=${interval}&theme=dark&style=1&locale=en&allow_symbol_change=true&calendar=false&hide_side_toolbar=0&save_image=false&support_host=https://www.tradingview.com&backgroundColor=rgba(10,10,10,1)&gridColor=rgba(31,31,31,1)`;
}

export default function TradingViewChart() {
  const { selectedSymbol } = useMarketStore();
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [inputSymbol, setInputSymbol] = useState(selectedSymbol);
  const [activeSymbol, setActiveSymbol] = useState(selectedSymbol);
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setActiveSymbol(selectedSymbol);
    setInputSymbol(selectedSymbol);
    setIsLoading(true);
  }, [selectedSymbol]);

  const handleSymbolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputSymbol.trim()) {
      setActiveSymbol(inputSymbol.toUpperCase().trim());
      setIsLoading(true);
    }
  };

  const tvUrl = buildTVUrl(activeSymbol, timeframe);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#0d0d0d] border-b border-[#1f1f1f] shrink-0">
        {/* Symbol Input */}
        <form onSubmit={handleSymbolSubmit} className="flex items-center">
          <input
            type="text"
            value={inputSymbol}
            onChange={(e) => setInputSymbol(e.target.value.toUpperCase())}
            placeholder="Symbol..."
            className="w-28 bg-[#1a1a1a] border border-[#2a2a2a] text-[#ff6600] font-mono text-xs px-2 py-1 rounded focus:outline-none focus:border-[#ff6600]/60 placeholder-[#444444]"
          />
          <button
            type="submit"
            className="ml-1 px-2 py-1 bg-[#ff6600]/20 border border-[#ff6600]/40 text-[#ff6600] font-mono text-[10px] rounded hover:bg-[#ff6600]/30 transition-colors"
          >
            GO
          </button>
        </form>

        <div className="w-px h-4 bg-[#1f1f1f]" />

        {/* Timeframe buttons */}
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => { setTimeframe(tf); setIsLoading(true); }}
              className={clsx(
                'px-2.5 py-1 font-mono text-[10px] rounded transition-all',
                timeframe === tf
                  ? 'bg-[#ff6600] text-black font-bold'
                  : 'text-[#888888] hover:text-[#e8e8e8] hover:bg-[#1a1a1a]'
              )}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[#888888] font-mono text-[10px]">
            {activeSymbol} • {timeframe}
          </span>
          <span className="text-[#444444] font-mono text-[9px]">via TradingView</span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#ff6600]/30 border-t-[#ff6600] rounded-full animate-spin" />
              <span className="text-[#888888] font-mono text-xs">LOADING CHART...</span>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          key={`${activeSymbol}-${timeframe}`}
          src={tvUrl}
          className="w-full h-full border-0"
          allowFullScreen
          onLoad={() => setIsLoading(false)}
          title={`${activeSymbol} Chart`}
        />
      </div>
    </div>
  );
}
