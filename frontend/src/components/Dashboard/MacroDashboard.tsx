import { useMacroIndicators } from '@/hooks/useMacroData';
import type { MacroIndicator } from '@/types';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

function Skeleton() {
  return (
    <div className="bg-[#111111] border border-[#1f1f1f] rounded p-4 animate-pulse">
      <div className="h-3 bg-[#1f1f1f] rounded w-24 mb-3" />
      <div className="h-8 bg-[#1f1f1f] rounded w-16 mb-2" />
      <div className="h-3 bg-[#1f1f1f] rounded w-20" />
    </div>
  );
}

function MacroCard({ indicator }: { indicator: MacroIndicator }) {
  const isUp = indicator.trend === 'up';
  const isDown = indicator.trend === 'down';

  const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const trendColor = (() => {
    if (indicator.sentiment === 'positive') return '#00d37f';
    if (indicator.sentiment === 'negative') return '#ff3b3b';
    return '#888888';
  })();

  const formatValue = (val: number, unit: string) => {
    if (unit === '%') return `${val.toFixed(2)}%`;
    if (val >= 1_000_000_000_000) return `$${(val / 1_000_000_000_000).toFixed(1)}T`;
    if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
    return val.toFixed(2) + (unit ? ` ${unit}` : '');
  };

  return (
    <div className={clsx(
      'bg-[#111111] border border-[#1f1f1f] rounded p-4 hover:border-[#2a2a2a] transition-all',
      indicator.sentiment === 'positive' && 'border-l-2 border-l-[#00d37f]',
      indicator.sentiment === 'negative' && 'border-l-2 border-l-[#ff3b3b]',
      indicator.sentiment === 'neutral' && 'border-l-2 border-l-[#888888]',
    )}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-[#888888] font-mono text-[10px] uppercase tracking-wider leading-tight">
          {indicator.name}
        </span>
        <TrendIcon size={12} style={{ color: trendColor }} />
      </div>

      <div className="font-mono text-2xl font-black tabular-nums" style={{ color: trendColor }}>
        {formatValue(indicator.value, indicator.unit)}
      </div>

      {indicator.change !== undefined && indicator.previous !== undefined && (
        <div className="mt-1.5 flex items-center gap-2">
          <span className={clsx(
            'font-mono text-[10px] tabular-nums',
            (indicator.change ?? 0) >= 0 ? 'text-[#00d37f]' : 'text-[#ff3b3b]'
          )}>
            {(indicator.change ?? 0) >= 0 ? '+' : ''}{(indicator.change ?? 0).toFixed(2)}{indicator.unit}
          </span>
          <span className="text-[#444444] font-mono text-[9px]">
            prev: {formatValue(indicator.previous ?? 0, indicator.unit)}
          </span>
        </div>
      )}

      {indicator.description && (
        <div className="mt-1 text-[#555555] font-mono text-[9px] truncate">
          {indicator.description}
        </div>
      )}
    </div>
  );
}

export default function MacroDashboard() {
  const { data: indicators, isLoading } = useMacroIndicators();

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-3 bg-[#1f1f1f] rounded w-32 animate-pulse" />
          <div className="flex-1 h-px bg-[#1f1f1f]" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)}
        </div>
      </div>
    );
  }

  const data = indicators ?? [];

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[#ff6600] font-mono text-[10px] font-bold tracking-widest">
            KEY MACRO INDICATORS
          </span>
          <div className="flex-1 h-px bg-[#1f1f1f] w-8" />
        </div>
        <span className="text-[#444444] font-mono text-[9px]">
          Last updated: {format(new Date(), 'HH:mm:ss')}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {data.map((indicator) => (
          <MacroCard key={indicator.id} indicator={indicator} />
        ))}
      </div>
    </div>
  );
}
