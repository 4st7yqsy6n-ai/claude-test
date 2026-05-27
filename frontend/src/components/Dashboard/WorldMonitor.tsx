import { useWorldIndices } from '@/hooks/useMacroData';
import type { WorldIndex } from '@/lib/api';
import clsx from 'clsx';

const REGIONS: { key: 'americas' | 'europe' | 'asia-pacific'; label: string }[] = [
  { key: 'americas',      label: 'AMERICAS' },
  { key: 'europe',        label: 'EUROPE' },
  { key: 'asia-pacific',  label: 'ASIA-PACIFIC' },
];

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  koyfin:   { label: 'KOYFIN LIVE',  color: '#a855f7' },
  yfinance: { label: 'YFINANCE',     color: '#00d37f' },
  mock:     { label: 'DEMO DATA',    color: '#888888' },
};

function IndexRow({ index }: { index: WorldIndex }) {
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
        <div className={clsx('font-mono text-[9px] tabular-nums', isUp ? 'text-[#00d37f]' : 'text-[#ff3b3b]')}>
          {isUp ? '+' : ''}{index.change_pct.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

function RegionSkeleton() {
  return (
    <div className="bg-[#111111] border border-[#1f1f1f] rounded overflow-hidden animate-pulse">
      <div className="px-3 py-2 border-b border-[#1f1f1f] h-8 bg-[#1a1a1a]" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2 border-t border-[#1a1a1a]">
          <div className="w-5 h-5 rounded-full bg-[#1f1f1f]" />
          <div className="flex-1 space-y-1">
            <div className="h-2.5 bg-[#1f1f1f] rounded w-12" />
            <div className="h-2 bg-[#1f1f1f] rounded w-20" />
          </div>
          <div className="space-y-1 text-right">
            <div className="h-2.5 bg-[#1f1f1f] rounded w-16" />
            <div className="h-2 bg-[#1f1f1f] rounded w-10 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WorldMonitor() {
  const { data, isLoading } = useWorldIndices();
  const source = data?.source ?? 'mock';
  const badge = SOURCE_BADGE[source] ?? SOURCE_BADGE.mock;

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[#ff6600] font-mono text-[10px] font-bold tracking-widest">WORLD MONITOR</span>
        <div className="flex-1 h-px bg-[#1f1f1f]" />
        <span className="font-mono text-[9px] px-2 py-0.5 rounded border"
          style={{ color: badge.color, borderColor: `${badge.color}44`, background: `${badge.color}11` }}>
          {badge.label}
        </span>
        <span className="text-[#444444] font-mono text-[9px]">GLOBAL EQUITY INDICES</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading
          ? REGIONS.map(({ key }) => <RegionSkeleton key={key} />)
          : REGIONS.map(({ key, label }) => {
              const regionIndices = data?.indices[key] ?? [];
              const avgChange = regionIndices.length
                ? regionIndices.reduce((s, i) => s + i.change_pct, 0) / regionIndices.length
                : 0;

              return (
                <div key={key} className="bg-[#111111] border border-[#1f1f1f] rounded overflow-hidden">
                  <div className={clsx(
                    'px-3 py-2 border-b border-[#1f1f1f] flex items-center justify-between',
                    avgChange >= 0 ? 'bg-[#00d37f]/5' : 'bg-[#ff3b3b]/5',
                  )}>
                    <span className="text-[#888888] font-mono text-[9px] tracking-widest">{label}</span>
                    <span className={clsx('font-mono text-[10px] font-bold', avgChange >= 0 ? 'text-[#00d37f]' : 'text-[#ff3b3b]')}>
                      {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%
                    </span>
                  </div>
                  <div className="divide-y divide-[#1a1a1a]">
                    {regionIndices.map((index) => <IndexRow key={index.symbol} index={index} />)}
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}
