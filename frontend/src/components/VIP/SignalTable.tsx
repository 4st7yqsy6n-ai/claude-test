import { useState } from 'react';
import type { VIPSignal } from '@/lib/api';

interface Props {
  signals: VIPSignal[];
}

function ConfidenceBar({ value, label }: { value: number; label: string }) {
  const color = value >= 70 ? '#00d37f' : value >= 50 ? '#f59e0b' : '#ff3b3b';
  return (
    <div className="flex flex-col gap-0.5 min-w-[64px]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px]" style={{ color }}>{label}</span>
        <span className="font-mono text-[9px] tabular-nums text-[#e8e8e8]">{value}%</span>
      </div>
      <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: VIPSignal['status'] }) {
  if (status === 'ACTIVE') {
    return (
      <span className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00d37f] animate-pulse" />
        <span className="font-mono text-[9px] text-[#00d37f] tracking-wider">ACTIVE</span>
      </span>
    );
  }
  if (status === 'TRIGGERED') {
    return (
      <span className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ff6600]" />
        <span className="font-mono text-[9px] text-[#ff6600] tracking-wider">TRIGGERED</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-[#888888]" />
      <span className="font-mono text-[9px] text-[#888888] tracking-wider">PENDING</span>
    </span>
  );
}

function AlignmentIcon({ aligned }: { aligned: boolean }) {
  if (aligned) {
    return <span className="text-[#00d37f] text-sm" title="Regime Aligned">✓</span>;
  }
  return <span className="text-[#ff6600] text-sm" title="Not Regime Aligned">⚠</span>;
}

export default function SignalTable({ signals }: Props) {
  const [expandedPair, setExpandedPair] = useState<string | null>(null);

  const sorted = [...signals].sort((a, b) => b.confidence - a.confidence);

  const now = sorted[0]?.generated_at ? new Date(sorted[0].generated_at) : new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="flex flex-col bg-[#0d0d0d] border border-[#1f1f1f] rounded-sm overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1f1f1f] shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-widest text-[#888888] uppercase">VIP Signals</span>
          <span className="bg-[#ff6600]/20 text-[#ff6600] font-mono text-[9px] px-1.5 py-0.5 rounded">
            {signals.length} ACTIVE
          </span>
        </div>
        <span className="font-mono text-[9px] text-[#444444]">Generated {dateStr} {timeStr}</span>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[80px_60px_100px_64px_130px_80px_48px_52px_80px] gap-2 px-3 py-1.5 border-b border-[#1f1f1f] shrink-0">
        {['PAIR', 'DIR', 'ENTRY ZONE', 'SL', 'TP1 / TP2 / TP3', 'CONF', 'R:R', 'TF', 'STATUS'].map((h) => (
          <span key={h} className="font-mono text-[8px] text-[#444444] tracking-widest uppercase">{h}</span>
        ))}
      </div>

      {/* Signal Rows */}
      <div className="flex-1 overflow-auto">
        {sorted.map((signal) => {
          const isExpanded = expandedPair === signal.pair;
          const dirColor = signal.direction === 'LONG' ? '#00d37f' : '#ff3b3b';
          const dirArrow = signal.direction === 'LONG' ? '▲' : '▼';

          return (
            <div key={signal.pair} className="border-b border-[#111111]">
              {/* Main Row */}
              <button
                onClick={() => setExpandedPair(isExpanded ? null : signal.pair)}
                className="w-full grid grid-cols-[80px_60px_100px_64px_130px_80px_48px_52px_80px] gap-2 px-3 py-2.5 hover:bg-[#111111] transition-colors text-left"
              >
                {/* Pair */}
                <div className="flex items-center">
                  <span className="font-mono text-[10px] font-bold text-[#e8e8e8]">{signal.pair}</span>
                </div>

                {/* Direction */}
                <div className="flex items-center gap-1">
                  <span className="font-mono text-sm font-bold" style={{ color: dirColor }}>{dirArrow}</span>
                  <span className="font-mono text-[9px] font-bold tracking-wider" style={{ color: dirColor }}>{signal.direction}</span>
                </div>

                {/* Entry Zone */}
                <div className="flex items-center">
                  <span className="font-mono text-[9px] text-[#e8e8e8] tabular-nums">{signal.entry_zone}</span>
                </div>

                {/* Stop Loss */}
                <div className="flex items-center">
                  <span className="font-mono text-[9px] text-[#ff3b3b] tabular-nums">{signal.stop_loss}</span>
                </div>

                {/* TP Levels */}
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[9px] text-[#00d37f] tabular-nums">{signal.tp1}</span>
                  <span className="text-[#333333] font-mono text-[8px]">/</span>
                  <span className="font-mono text-[9px] text-[#00d37f] tabular-nums">{signal.tp2}</span>
                  <span className="text-[#333333] font-mono text-[8px]">/</span>
                  <span className="font-mono text-[9px] text-[#00d37f] tabular-nums">{signal.tp3}</span>
                </div>

                {/* Confidence */}
                <div className="flex items-center">
                  <ConfidenceBar value={signal.confidence} label={signal.confidence_label} />
                </div>

                {/* R:R */}
                <div className="flex items-center">
                  <span className="font-mono text-[9px] text-[#e8e8e8] tabular-nums">{signal.r_r_ratio.toFixed(1)}</span>
                </div>

                {/* Timeframe */}
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[9px] text-[#888888]">{signal.time_frame}</span>
                  <AlignmentIcon aligned={signal.regime_alignment} />
                </div>

                {/* Status */}
                <div className="flex items-center">
                  <StatusBadge status={signal.status} />
                </div>
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="px-4 pb-4 bg-[#0a0a0a] border-t border-[#1a1a1a]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                    {/* Rationale */}
                    <div>
                      <div className="font-mono text-[9px] text-[#ff6600] tracking-widest uppercase mb-1.5">Trade Rationale</div>
                      <p className="font-mono text-[10px] text-[#888888] leading-relaxed">{signal.rationale}</p>
                    </div>

                    {/* Details */}
                    <div className="space-y-2">
                      <div>
                        <div className="font-mono text-[9px] text-[#ff3b3b] tracking-widest uppercase mb-1">Invalidation Level</div>
                        <p className="font-mono text-[10px] text-[#e8e8e8]">{signal.invalidation}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="font-mono text-[9px] text-[#444444] uppercase mb-0.5">Regime Aligned</div>
                          <div className={`font-mono text-[10px] font-bold ${signal.regime_alignment ? 'text-[#00d37f]' : 'text-[#ff6600]'}`}>
                            {signal.regime_alignment ? 'YES ✓' : 'NO ⚠'}
                          </div>
                        </div>
                        <div>
                          <div className="font-mono text-[9px] text-[#444444] uppercase mb-0.5">Time Frame</div>
                          <div className="font-mono text-[10px] text-[#e8e8e8]">{signal.time_frame}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
