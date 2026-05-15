import { useState } from 'react';
import { useScreenerMovers, useHeatmapData } from '@/hooks/useMarketData';
import { useMarketStore } from '@/stores/marketStore';
import type { ScreenerResult } from '@/types';
import clsx from 'clsx';

function formatLargeNumber(n: number): string {
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return n.toLocaleString('en-US');
}

function MoverRow({ result, rank }: { result: ScreenerResult; rank: number }) {
  const { setSelectedSymbol } = useMarketStore();
  const isUp = result.change_pct >= 0;

  return (
    <tr
      className="border-b border-[#1a1a1a] hover:bg-[#141414] cursor-pointer transition-colors"
      onClick={() => setSelectedSymbol(result.symbol)}
    >
      <td className="py-2 px-3 font-mono text-[#444444] text-[10px] w-8">{rank}</td>
      <td className="py-2 px-2">
        <div className="font-mono text-[11px] font-bold text-[#ff6600]">{result.symbol}</div>
        <div className="font-mono text-[9px] text-[#555555] truncate max-w-[100px]">{result.name}</div>
      </td>
      <td className="py-2 px-2 text-right font-mono text-[11px] text-[#e8e8e8] tabular-nums">
        ${result.price.toFixed(2)}
      </td>
      <td className={clsx('py-2 px-2 text-right font-mono text-[10px] tabular-nums', isUp ? 'text-[#00d37f]' : 'text-[#ff3b3b]')}>
        {isUp ? '+' : ''}{result.change.toFixed(2)}
      </td>
      <td className={clsx('py-2 px-2 text-right font-mono text-[11px] font-bold tabular-nums', isUp ? 'text-[#00d37f]' : 'text-[#ff3b3b]')}>
        {isUp ? '+' : ''}{result.change_pct.toFixed(2)}%
      </td>
      <td className="py-2 px-2 text-right font-mono text-[10px] text-[#888888] tabular-nums">
        {formatLargeNumber(result.volume)}
      </td>
      <td className="py-2 px-2 text-right font-mono text-[10px] text-[#888888] tabular-nums">
        {result.market_cap ? formatLargeNumber(result.market_cap) : '—'}
      </td>
      <td className="py-2 px-2">
        {result.sector && (
          <span className="font-mono text-[9px] text-[#888888] bg-[#1a1a1a] px-1.5 py-0.5 rounded whitespace-nowrap">
            {result.sector}
          </span>
        )}
      </td>
    </tr>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-[#1a1a1a] animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="py-2 px-2">
          <div className="h-3 bg-[#1f1f1f] rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

function TopMovers() {
  const [type, setType] = useState<'gainers' | 'losers'>('gainers');
  const { data: movers, isLoading } = useScreenerMovers(type);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f1f] shrink-0">
        <span className="text-[#ff6600] font-mono text-[10px] font-bold tracking-widest">TOP MOVERS</span>
        <div className="flex gap-1">
          {(['gainers', 'losers'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={clsx(
                'px-3 py-1 font-mono text-[10px] rounded transition-all',
                type === t
                  ? t === 'gainers' ? 'bg-[#00d37f] text-black font-bold' : 'bg-[#ff3b3b] text-white font-bold'
                  : 'text-[#888888] hover:text-[#e8e8e8] hover:bg-[#1a1a1a]'
              )}
            >
              {t === 'gainers' ? '▲ GAINERS' : '▼ LOSERS'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-[#0d0d0d] z-10">
            <tr className="border-b border-[#1f1f1f]">
              {['#', 'SYMBOL', 'PRICE', 'CHG', 'CHG%', 'VOLUME', 'MKT CAP', 'SECTOR'].map((h) => (
                <th key={h} className="py-2 px-2 text-left font-mono text-[9px] text-[#555555] tracking-widest">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              : (movers ?? []).map((m, i) => <MoverRow key={m.symbol} result={m} rank={i + 1} />)
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

function heatmapColor(pct: number): string {
  const intensity = Math.min(Math.abs(pct) / 3, 1);
  if (pct > 0) {
    const r = Math.round(0 * (1 - intensity) + 0 * intensity);
    const g = Math.round(60 * (1 - intensity) + 211 * intensity);
    const b = Math.round(60 * (1 - intensity) + 127 * intensity);
    return `rgb(${r},${g},${b})`;
  } else {
    const r = Math.round(60 * (1 - intensity) + 255 * intensity);
    const g = Math.round(60 * (1 - intensity) + 59 * intensity);
    const b = Math.round(60 * (1 - intensity) + 59 * intensity);
    return `rgb(${r},${g},${b})`;
  }
}

function SectorHeatmap() {
  const { data: sectors, isLoading } = useHeatmapData();

  if (isLoading) {
    return (
      <div className="flex-1 p-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 h-full">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="bg-[#1f1f1f] rounded animate-pulse" style={{ minHeight: 60 }} />
          ))}
        </div>
      </div>
    );
  }

  const maxWeight = Math.max(...(sectors ?? []).map((s) => s.weight ?? 1));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f1f] shrink-0">
        <span className="text-[#ff6600] font-mono text-[10px] font-bold tracking-widest">S&P 500 SECTOR HEATMAP</span>
        <span className="text-[#444444] font-mono text-[9px]">Block size = market weight</span>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {(sectors ?? []).map((sector) => {
            const weight = sector.weight ?? 1;
            const relSize = (weight / maxWeight);
            const minH = 50;
            const maxH = 120;
            const h = minH + (maxH - minH) * relSize;
            const bgColor = heatmapColor(sector.change_pct);
            const isUp = sector.change_pct >= 0;

            return (
              <div
                key={sector.name}
                className="rounded flex flex-col items-center justify-center p-2 cursor-default transition-transform hover:scale-105 border border-transparent hover:border-white/10"
                style={{ backgroundColor: bgColor + '33', minHeight: h, border: `1px solid ${bgColor}40` }}
              >
                <div className="text-[#e8e8e8] font-mono text-[10px] font-bold text-center leading-tight mb-1">
                  {sector.name}
                </div>
                <div className={clsx(
                  'font-mono text-sm font-black tabular-nums',
                  isUp ? 'text-[#00d37f]' : 'text-[#ff3b3b]'
                )}>
                  {isUp ? '+' : ''}{sector.change_pct.toFixed(2)}%
                </div>
                {sector.weight && (
                  <div className="text-[#888888] font-mono text-[9px] mt-0.5">
                    {sector.weight.toFixed(1)}% wt
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ScreenerPanel() {
  const [activePanel, setActivePanel] = useState<'movers' | 'heatmap'>('movers');

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d]">
      {/* Sub-tabs */}
      <div className="flex border-b border-[#1f1f1f] shrink-0">
        {[
          { key: 'movers' as const, label: 'TOP MOVERS' },
          { key: 'heatmap' as const, label: 'SECTOR HEATMAP' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActivePanel(key)}
            className={clsx(
              'px-4 py-3 font-mono text-[10px] tracking-wider border-b-2 transition-all',
              activePanel === key
                ? 'text-[#ff6600] border-[#ff6600] bg-[#ff6600]/5'
                : 'text-[#888888] border-transparent hover:text-[#e8e8e8] hover:bg-[#1a1a1a]'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {activePanel === 'movers' ? <TopMovers /> : <SectorHeatmap />}
      </div>
    </div>
  );
}
