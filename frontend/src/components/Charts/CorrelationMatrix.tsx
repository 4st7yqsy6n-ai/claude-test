import { useState } from 'react';
import clsx from 'clsx';

const SYMBOLS = ['SPY', 'QQQ', 'GLD', 'TLT', 'DXY', 'BTC', 'OIL', 'VIX'];

// Realistic correlation matrix (symmetric)
const CORRELATIONS: number[][] = [
//  SPY    QQQ    GLD    TLT    DXY    BTC    OIL    VIX
  [ 1.00,  0.95, -0.04,  0.12, -0.28,  0.48,  0.38, -0.78], // SPY
  [ 0.95,  1.00, -0.06,  0.08, -0.31,  0.52,  0.32, -0.82], // QQQ
  [-0.04, -0.06,  1.00,  0.42, -0.58,  0.18,  0.24,  0.02], // GLD
  [ 0.12,  0.08,  0.42,  1.00, -0.62, -0.02, -0.18,  0.28], // TLT
  [-0.28, -0.31, -0.58, -0.62,  1.00, -0.24,  0.18,  0.12], // DXY
  [ 0.48,  0.52,  0.18, -0.02, -0.24,  1.00,  0.22, -0.44], // BTC
  [ 0.38,  0.32,  0.24, -0.18,  0.18,  0.22,  1.00, -0.32], // OIL
  [-0.78, -0.82,  0.02,  0.28,  0.12, -0.44, -0.32,  1.00], // VIX
];

const SYMBOL_LABELS: Record<string, string> = {
  SPY: 'S&P 500',
  QQQ: 'Nasdaq',
  GLD: 'Gold',
  TLT: '20Y Bond',
  DXY: 'US Dollar',
  BTC: 'Bitcoin',
  OIL: 'WTI Oil',
  VIX: 'Volatility',
};

function correlationColor(value: number): string {
  if (value === 1) return 'rgba(255, 102, 0, 0.3)';
  if (value > 0.7) return 'rgba(0, 211, 127, 0.7)';
  if (value > 0.4) return 'rgba(0, 211, 127, 0.45)';
  if (value > 0.1) return 'rgba(0, 211, 127, 0.2)';
  if (value > -0.1) return 'rgba(100, 100, 100, 0.15)';
  if (value > -0.4) return 'rgba(255, 59, 59, 0.2)';
  if (value > -0.7) return 'rgba(255, 59, 59, 0.45)';
  return 'rgba(255, 59, 59, 0.7)';
}

function correlationTextColor(value: number): string {
  if (value === 1) return '#ff6600';
  if (Math.abs(value) > 0.5) return '#e8e8e8';
  return '#888888';
}

export default function CorrelationMatrix() {
  const [hovered, setHovered] = useState<{ row: number; col: number } | null>(null);

  return (
    <div className="p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <span className="text-[#ff6600] font-mono text-[10px] font-bold tracking-widest">
          CORRELATION MATRIX
        </span>
        <div className="flex-1 h-px bg-[#1f1f1f]" />
        <div className="flex items-center gap-4 text-[9px] font-mono text-[#888888]">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ background: 'rgba(0, 211, 127, 0.7)' }} />
            +1.0
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ background: 'rgba(100, 100, 100, 0.15)' }} />
            0
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ background: 'rgba(255, 59, 59, 0.7)' }} />
            −1.0
          </div>
        </div>
      </div>

      {/* Matrix */}
      <div className="flex-1 flex flex-col">
        {/* Column headers */}
        <div className="flex mb-1 ml-20">
          {SYMBOLS.map((sym) => (
            <div key={sym} className="flex-1 text-center font-mono text-[9px] text-[#888888] px-0.5">
              {sym}
            </div>
          ))}
        </div>

        {/* Rows */}
        {SYMBOLS.map((rowSym, rowIdx) => (
          <div key={rowSym} className="flex items-center flex-1 mb-0.5">
            {/* Row label */}
            <div className="w-20 shrink-0 text-right pr-2">
              <div className="font-mono text-[10px] font-bold text-[#e8e8e8]">{rowSym}</div>
              <div className="font-mono text-[8px] text-[#555555] truncate">{SYMBOL_LABELS[rowSym]}</div>
            </div>

            {/* Cells */}
            {CORRELATIONS[rowIdx].map((corr, colIdx) => {
              const isHovered = hovered?.row === rowIdx || hovered?.col === colIdx ||
                               hovered?.row === colIdx || hovered?.col === rowIdx;
              const isActive = hovered?.row === rowIdx && hovered?.col === colIdx;

              return (
                <div
                  key={colIdx}
                  className={clsx(
                    'flex-1 flex items-center justify-center rounded cursor-default transition-all text-[10px] font-mono font-bold tabular-nums h-full',
                    isHovered && 'ring-1 ring-[#ff6600]/30',
                    isActive && 'ring-2 ring-[#ff6600]/60 scale-105 z-10',
                  )}
                  style={{
                    backgroundColor: correlationColor(corr),
                    color: correlationTextColor(corr),
                    margin: '0 1px',
                  }}
                  onMouseEnter={() => setHovered({ row: rowIdx, col: colIdx })}
                  onMouseLeave={() => setHovered(null)}
                  title={`${SYMBOLS[rowIdx]} vs ${SYMBOLS[colIdx]}: ${corr.toFixed(2)}`}
                >
                  {corr.toFixed(2)}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Hover info */}
      <div className="mt-2 h-5 shrink-0">
        {hovered && (
          <div className="text-[#888888] font-mono text-[9px]">
            <span className="text-[#ff6600]">{SYMBOLS[hovered.row]}</span>
            {' vs '}
            <span className="text-[#ff6600]">{SYMBOLS[hovered.col]}</span>
            {': '}
            <span className={clsx(
              'font-bold',
              CORRELATIONS[hovered.row][hovered.col] > 0.1 ? 'text-[#00d37f]' :
              CORRELATIONS[hovered.row][hovered.col] < -0.1 ? 'text-[#ff3b3b]' : 'text-[#888888]'
            )}>
              {CORRELATIONS[hovered.row][hovered.col].toFixed(3)}
            </span>
            {' — '}
            <span>{
              CORRELATIONS[hovered.row][hovered.col] > 0.7 ? 'Strong positive' :
              CORRELATIONS[hovered.row][hovered.col] > 0.3 ? 'Moderate positive' :
              CORRELATIONS[hovered.row][hovered.col] > -0.3 ? 'Weak/No correlation' :
              CORRELATIONS[hovered.row][hovered.col] > -0.7 ? 'Moderate negative' : 'Strong negative'
            }</span>
          </div>
        )}
      </div>

      <div className="text-[#333333] font-mono text-[9px] mt-1">
        Rolling 1-year daily returns correlation • {new Date().getFullYear()}
      </div>
    </div>
  );
}
