import clsx from 'clsx';

interface GlobalIndex {
  symbol: string;
  name: string;
  country: string;
  flag: string;
  region: 'americas' | 'europe' | 'asia-pacific';
  price: number;
  change: number;
  change_pct: number;
}

const GLOBAL_INDICES: GlobalIndex[] = [
  // Americas
  { symbol: 'SPX', name: 'S&P 500', country: 'United States', flag: '🇺🇸', region: 'americas', price: 5847.23, change: 24.56, change_pct: 0.42 },
  { symbol: 'NDX', name: 'Nasdaq 100', country: 'United States', flag: '🇺🇸', region: 'americas', price: 20412.18, change: 142.33, change_pct: 0.70 },
  { symbol: 'TSX', name: 'TSX Composite', country: 'Canada', flag: '🇨🇦', region: 'americas', price: 22847.40, change: 88.12, change_pct: 0.39 },
  { symbol: 'IBOV', name: 'Bovespa', country: 'Brazil', flag: '🇧🇷', region: 'americas', price: 131244.80, change: -842.30, change_pct: -0.64 },
  { symbol: 'MXX', name: 'IPC Mexico', country: 'Mexico', flag: '🇲🇽', region: 'americas', price: 52438.20, change: 124.80, change_pct: 0.24 },

  // Europe
  { symbol: 'DAX', name: 'DAX 40', country: 'Germany', flag: '🇩🇪', region: 'europe', price: 19248.50, change: 184.20, change_pct: 0.97 },
  { symbol: 'FTSE', name: 'FTSE 100', country: 'United Kingdom', flag: '🇬🇧', region: 'europe', price: 8284.40, change: -42.30, change_pct: -0.51 },
  { symbol: 'CAC', name: 'CAC 40', country: 'France', flag: '🇫🇷', region: 'europe', price: 7602.80, change: 38.40, change_pct: 0.51 },
  { symbol: 'IBEX', name: 'IBEX 35', country: 'Spain', flag: '🇪🇸', region: 'europe', price: 11482.60, change: 94.10, change_pct: 0.83 },
  { symbol: 'SMI', name: 'SMI Index', country: 'Switzerland', flag: '🇨🇭', region: 'europe', price: 11924.80, change: -28.40, change_pct: -0.24 },

  // Asia-Pacific
  { symbol: 'N225', name: 'Nikkei 225', country: 'Japan', flag: '🇯🇵', region: 'asia-pacific', price: 38620.40, change: 482.80, change_pct: 1.27 },
  { symbol: 'HSI', name: 'Hang Seng', country: 'Hong Kong', flag: '🇭🇰', region: 'asia-pacific', price: 19281.50, change: -148.20, change_pct: -0.76 },
  { symbol: 'SHCOMP', name: 'Shanghai Comp.', country: 'China', flag: '🇨🇳', region: 'asia-pacific', price: 3302.48, change: 24.82, change_pct: 0.76 },
  { symbol: 'ASX', name: 'ASX 200', country: 'Australia', flag: '🇦🇺', region: 'asia-pacific', price: 8284.40, change: 48.20, change_pct: 0.58 },
  { symbol: 'KOSPI', name: 'KOSPI', country: 'South Korea', flag: '🇰🇷', region: 'asia-pacific', price: 2574.82, change: -18.42, change_pct: -0.71 },
];

const REGIONS = [
  { key: 'americas' as const, label: 'AMERICAS' },
  { key: 'europe' as const, label: 'EUROPE' },
  { key: 'asia-pacific' as const, label: 'ASIA-PACIFIC' },
];

function IndexRow({ index }: { index: GlobalIndex }) {
  const isUp = index.change_pct >= 0;

  return (
    <div className="flex items-center gap-2 px-3 py-2 hover:bg-[#1a1a1a] transition-colors rounded">
      <span className="text-base leading-none shrink-0">{index.flag}</span>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[10px] font-bold text-[#e8e8e8]">{index.symbol}</div>
        <div className="font-mono text-[9px] text-[#888888] truncate">{index.name}</div>
      </div>
      <div className="text-right">
        <div className="font-mono text-[11px] text-[#e8e8e8] tabular-nums">
          {index.price >= 10000
            ? index.price.toLocaleString('en-US', { maximumFractionDigits: 0 })
            : index.price.toFixed(2)}
        </div>
        <div className={clsx(
          'font-mono text-[9px] tabular-nums',
          isUp ? 'text-[#00d37f]' : 'text-[#ff3b3b]'
        )}>
          {isUp ? '+' : ''}{index.change_pct.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

export default function WorldMonitor() {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[#ff6600] font-mono text-[10px] font-bold tracking-widest">WORLD MONITOR</span>
        <div className="flex-1 h-px bg-[#1f1f1f]" />
        <span className="text-[#444444] font-mono text-[9px]">GLOBAL EQUITY INDICES</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {REGIONS.map(({ key, label }) => {
          const regionIndices = GLOBAL_INDICES.filter((idx) => idx.region === key);
          const avgChange = regionIndices.reduce((sum, idx) => sum + idx.change_pct, 0) / regionIndices.length;

          return (
            <div key={key} className="bg-[#111111] border border-[#1f1f1f] rounded overflow-hidden">
              <div className={clsx(
                'px-3 py-2 border-b border-[#1f1f1f] flex items-center justify-between',
                avgChange >= 0 ? 'bg-[#00d37f]/5' : 'bg-[#ff3b3b]/5'
              )}>
                <span className="text-[#888888] font-mono text-[9px] tracking-widest">{label}</span>
                <span className={clsx(
                  'font-mono text-[10px] font-bold',
                  avgChange >= 0 ? 'text-[#00d37f]' : 'text-[#ff3b3b]'
                )}>
                  {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%
                </span>
              </div>
              <div className="divide-y divide-[#1a1a1a]">
                {regionIndices.map((index) => (
                  <IndexRow key={index.symbol} index={index} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
