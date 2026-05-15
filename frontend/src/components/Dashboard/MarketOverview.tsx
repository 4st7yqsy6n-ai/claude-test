import { useMarketOverview } from '@/hooks/useMarketData';
import { useMarketStore } from '@/stores/marketStore';
import MiniChart from '@/components/Charts/MiniChart';
import type { MarketItem } from '@/types';
import clsx from 'clsx';

const CATEGORY_SECTIONS = [
  { key: 'index', label: 'EQUITY INDICES' },
  { key: 'fx', label: 'FX MAJORS' },
  { key: 'crypto', label: 'CRYPTO' },
  { key: 'commodity', label: 'COMMODITIES' },
  { key: 'rate', label: 'RATES' },
] as const;

function formatPrice(price: number, category: string): string {
  if (category === 'fx') return price.toFixed(4);
  if (category === 'rate') return price.toFixed(3) + '%';
  if (price >= 10_000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (price >= 1_000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (price >= 100) return price.toFixed(2);
  return price.toFixed(4);
}

function Skeleton() {
  return (
    <div className="bg-[#111111] border border-[#1f1f1f] rounded p-3 animate-pulse">
      <div className="h-3 bg-[#1f1f1f] rounded w-16 mb-2" />
      <div className="h-4 bg-[#1f1f1f] rounded w-24 mb-1" />
      <div className="h-3 bg-[#1f1f1f] rounded w-12" />
    </div>
  );
}

function MarketCard({ item }: { item: MarketItem }) {
  const { setSelectedSymbol, liveprices, priceFlash } = useMarketStore();
  const live = liveprices[item.symbol];
  const flash = priceFlash[item.symbol];

  const price = live?.price ?? item.price;
  const change = live?.change ?? item.change;
  const change_pct = live?.change_pct ?? item.change_pct;
  const isUp = change_pct >= 0;

  return (
    <button
      onClick={() => setSelectedSymbol(item.symbol)}
      className={clsx(
        'bg-[#111111] border rounded p-3 text-left hover:bg-[#161616] transition-all group relative overflow-hidden',
        isUp ? 'border-l-2 border-l-[#00d37f] border-[#1f1f1f]' : 'border-l-2 border-l-[#ff3b3b] border-[#1f1f1f]',
        flash === 'up' && 'bg-[#00d37f]/5',
        flash === 'down' && 'bg-[#ff3b3b]/5',
      )}
    >
      <div className="flex items-start justify-between mb-1.5">
        <div>
          <div className="font-mono text-[10px] font-bold text-[#ff6600] tracking-wider">{item.symbol}</div>
          <div className="font-mono text-[9px] text-[#888888] truncate max-w-[90px]">{item.name}</div>
        </div>
        <div className={clsx(
          'text-[9px] font-mono px-1 py-0.5 rounded',
          isUp ? 'text-[#00d37f] bg-[#00d37f]/10' : 'text-[#ff3b3b] bg-[#ff3b3b]/10'
        )}>
          {isUp ? '▲' : '▼'} {Math.abs(change_pct).toFixed(2)}%
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="font-mono text-sm font-bold text-[#e8e8e8] tabular-nums">
            {formatPrice(price, item.category)}
          </div>
          <div className={clsx(
            'font-mono text-[9px] tabular-nums',
            isUp ? 'text-[#00d37f]' : 'text-[#ff3b3b]'
          )}>
            {isUp ? '+' : ''}{change.toFixed(item.category === 'fx' ? 4 : 2)}
          </div>
        </div>

        {item.sparkline && item.sparkline.length > 1 && (
          <div className="w-20 opacity-80 group-hover:opacity-100 transition-opacity">
            <MiniChart data={item.sparkline} positive={isUp} height={32} />
          </div>
        )}
      </div>
    </button>
  );
}

export default function MarketOverview() {
  const { data: marketData, isLoading } = useMarketOverview();

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {CATEGORY_SECTIONS.map((section) => (
          <div key={section.key}>
            <div className="h-3 bg-[#1f1f1f] rounded w-28 mb-3 animate-pulse" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} />)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const items = marketData ?? [];

  return (
    <div className="p-4 space-y-4 overflow-auto">
      {CATEGORY_SECTIONS.map((section) => {
        const sectionItems = items.filter((item) => item.category === section.key);
        if (sectionItems.length === 0) return null;

        return (
          <div key={section.key}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[#ff6600] font-mono text-[10px] font-bold tracking-widest">
                {section.label}
              </span>
              <div className="flex-1 h-px bg-[#1f1f1f]" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {sectionItems.map((item) => (
                <MarketCard key={item.symbol} item={item} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
