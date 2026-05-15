import { useState, useCallback } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import clsx from 'clsx';

const TICKER_SYMBOLS = [
  { symbol: 'SPX', label: 'S&P 500' },
  { symbol: 'NDX', label: 'NAS 100' },
  { symbol: 'DJI', label: 'DOW' },
  { symbol: 'VIX', label: 'VIX' },
  { symbol: 'EURUSD', label: 'EUR/USD' },
  { symbol: 'GBPUSD', label: 'GBP/USD' },
  { symbol: 'USDJPY', label: 'USD/JPY' },
  { symbol: 'BTCUSD', label: 'BTC/USD' },
  { symbol: 'ETHUSD', label: 'ETH/USD' },
  { symbol: 'XAUUSD', label: 'XAU/USD' },
  { symbol: 'USOIL', label: 'WTI OIL' },
  { symbol: 'US10Y', label: 'US10Y' },
  { symbol: 'US2Y', label: 'US2Y' },
];

function formatPrice(price: number, symbol: string): string {
  if (symbol.includes('USD') && !symbol.includes('BTC') && !symbol.includes('ETH') && !symbol.includes('XAU') && !['USOIL'].includes(symbol)) {
    // FX pairs
    return price.toFixed(4);
  }
  if (price >= 10_000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (price >= 1_000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (price >= 100) return price.toFixed(2);
  return price.toFixed(4);
}

function TickerItem({ symbol, label }: { symbol: string; label: string }) {
  const { liveprices, priceFlash } = useMarketStore();
  const data = liveprices[symbol];
  if (!data) return null;

  const isUp = data.change_pct >= 0;
  const flash = priceFlash[symbol];

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-3 border-r border-[#1f1f1f] whitespace-nowrap transition-all duration-300',
        flash === 'up' && 'bg-[#00d37f]/20',
        flash === 'down' && 'bg-[#ff3b3b]/20',
      )}
    >
      <span className="text-[#888888] font-mono text-[10px]">{label}</span>
      <span className="text-[#e8e8e8] font-mono text-[10px] tabular-nums font-medium">
        {formatPrice(data.price, symbol)}
      </span>
      <span className={clsx(
        'font-mono text-[10px] tabular-nums',
        isUp ? 'text-[#00d37f]' : 'text-[#ff3b3b]'
      )}>
        {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{data.change_pct.toFixed(2)}%
      </span>
    </span>
  );
}

export default function TickerTape() {
  const [paused, setPaused] = useState(false);

  const handleMouseEnter = useCallback(() => setPaused(true), []);
  const handleMouseLeave = useCallback(() => setPaused(false), []);

  // Duplicate for seamless loop
  const items = [...TICKER_SYMBOLS, ...TICKER_SYMBOLS];

  return (
    <div
      className="h-8 bg-[#0a0a0a] border-b border-[#1f1f1f] overflow-hidden flex items-center relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Left fade */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
      {/* Right fade */}
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0a0a0a] to-transparent z-10 pointer-events-none" />

      <div
        className={clsx(
          'flex items-center',
          !paused && 'animate-ticker'
        )}
        style={{ willChange: 'transform' }}
      >
        {items.map((item, i) => (
          <TickerItem key={`${item.symbol}-${i}`} symbol={item.symbol} label={item.label} />
        ))}
      </div>
    </div>
  );
}
