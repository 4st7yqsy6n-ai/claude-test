import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import type { PortfolioRiskResult } from '@/lib/api';

const PAIRS = ['XAU/USD', 'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'NZD/USD', 'EUR/JPY', 'GBP/JPY', 'XAU/EUR'];

const STATIC_CORRELATION: Record<string, Record<string, number>> = {
  'XAU/USD': { 'XAU/USD': 1.0, 'EUR/USD': 0.62, 'GBP/USD': 0.54, 'AUD/USD': 0.48, 'USD/JPY': -0.41 },
  'EUR/USD': { 'XAU/USD': 0.62, 'EUR/USD': 1.0, 'GBP/USD': 0.78, 'AUD/USD': 0.65, 'USD/JPY': -0.55 },
  'GBP/USD': { 'XAU/USD': 0.54, 'EUR/USD': 0.78, 'GBP/USD': 1.0, 'AUD/USD': 0.61, 'USD/JPY': -0.48 },
  'AUD/USD': { 'XAU/USD': 0.48, 'EUR/USD': 0.65, 'GBP/USD': 0.61, 'AUD/USD': 1.0, 'USD/JPY': -0.52 },
  'USD/JPY': { 'XAU/USD': -0.41, 'EUR/USD': -0.55, 'GBP/USD': -0.48, 'AUD/USD': -0.52, 'USD/JPY': 1.0 },
};

const CORR_PAIRS = ['XAU/USD', 'EUR/USD', 'GBP/USD', 'AUD/USD', 'USD/JPY'];

interface Position {
  id: string;
  pair: string;
  lots: number;
  entry: number;
  sl: number;
  accountSize: number;
  riskPct: number;
}

function createDefaultPosition(): Position {
  return {
    id: Math.random().toString(36).slice(2),
    pair: 'XAU/USD',
    lots: 0.5,
    entry: 2620,
    sl: 2580,
    accountSize: 10000,
    riskPct: 1,
  };
}

function calcRiskUSD(pos: Position): number {
  const pipsAtRisk = Math.abs(pos.entry - pos.sl);
  // For gold: pip value ≈ $1 per 0.01 lot per pip. Simplified:
  const pipValue = pos.pair === 'XAU/USD' || pos.pair === 'XAU/EUR' ? 1 : 10;
  return pipsAtRisk * pos.lots * pipValue * 100;
}

function CorrelationHeatmap({ matrix }: { matrix: Record<string, Record<string, number>> }) {
  const pairs = CORR_PAIRS;
  return (
    <div className="overflow-auto">
      <div className="font-mono text-[9px] text-[#888888] tracking-widest uppercase mb-2">Correlation Matrix (1Y)</div>
      <div className="grid" style={{ gridTemplateColumns: `80px repeat(${pairs.length}, 1fr)` }}>
        {/* Header row */}
        <div />
        {pairs.map((p) => (
          <div key={p} className="font-mono text-[7px] text-[#444444] text-center pb-1 truncate px-0.5">{p.split('/')[0]}</div>
        ))}
        {/* Data rows */}
        {pairs.map((rowP) => (
          <>
            <div key={rowP + '_label'} className="font-mono text-[8px] text-[#888888] pr-1 flex items-center truncate">{rowP}</div>
            {pairs.map((colP) => {
              const val = matrix[rowP]?.[colP] ?? (rowP === colP ? 1 : 0);
              const abs = Math.abs(val);
              const isPos = val >= 0;
              const bg = val === 1
                ? 'rgba(255,102,0,0.6)'
                : isPos
                ? `rgba(0,211,127,${0.1 + abs * 0.65})`
                : `rgba(255,59,59,${0.1 + abs * 0.65})`;
              return (
                <div
                  key={colP}
                  className="flex items-center justify-center h-8 m-0.5 rounded text-[8px] font-mono font-bold tabular-nums"
                  style={{ backgroundColor: bg, color: abs > 0.5 ? '#e8e8e8' : '#888888' }}
                  title={`${rowP} / ${colP}: ${val.toFixed(2)}`}
                >
                  {val.toFixed(2)}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

function computeMockResults(positions: Position[]): PortfolioRiskResult {
  const totalRiskUSD = positions.reduce((sum, p) => sum + calcRiskUSD(p), 0);
  const goldPositions = positions.filter((p) => p.pair.includes('XAU'));
  const goldExposure = goldPositions.reduce((s, p) => s + p.lots * p.entry * 100, 0);
  const totalExposure = positions.reduce((s, p) => s + p.lots * p.entry * 100, 0);
  const concentration = goldExposure / totalExposure;
  const concentrationRisk: 'LOW' | 'MEDIUM' | 'HIGH' = concentration > 0.6 ? 'HIGH' : concentration > 0.35 ? 'MEDIUM' : 'LOW';
  const warnings: string[] = [];
  if (concentrationRisk === 'HIGH') warnings.push('Gold exposure >60% of portfolio — reduce concentration risk');
  if (totalRiskUSD > positions[0]?.accountSize * 0.03) warnings.push('Total risk exceeds 3% of account — reduce position sizes');
  if (positions.length > 3) warnings.push('Multiple correlated USD positions detected — check correlation matrix');

  return {
    total_exposure_usd: totalExposure,
    usd_exposure: totalExposure - goldExposure,
    gold_exposure: goldExposure,
    positions_summary: positions.map((p) => ({ pair: p.pair, lots: p.lots, risk_usd: calcRiskUSD(p) })),
    correlation_matrix: STATIC_CORRELATION,
    portfolio_var_95: totalRiskUSD * 1.65,
    portfolio_var_99: totalRiskUSD * 2.33,
    expected_drawdown: totalRiskUSD * 2.1,
    concentration_risk: concentrationRisk,
    position_sizes: positions.map((p) => ({
      pair: p.pair,
      recommended_lots: parseFloat((((p.accountSize * p.riskPct) / 100) / (Math.abs(p.entry - p.sl) * 100)).toFixed(2)),
      max_lots: parseFloat((((p.accountSize * 0.02) / 100) / (Math.abs(p.entry - p.sl) * 100)).toFixed(2)),
    })),
    risk_warnings: warnings,
  };
}

function ConcentrationBadge({ level }: { level: 'LOW' | 'MEDIUM' | 'HIGH' }) {
  const colors: Record<string, string> = { LOW: '#00d37f', MEDIUM: '#f59e0b', HIGH: '#ff3b3b' };
  return (
    <span
      className="font-mono text-[9px] font-bold px-2 py-0.5 rounded border tracking-wider"
      style={{ color: colors[level], borderColor: colors[level] + '44', backgroundColor: colors[level] + '11' }}
    >
      {level}
    </span>
  );
}

export default function RiskAnalytics() {
  const [positions, setPositions] = useState<Position[]>([createDefaultPosition()]);
  const [results, setResults] = useState<PortfolioRiskResult | null>(null);

  function addPosition() {
    setPositions((prev) => [...prev, createDefaultPosition()]);
  }

  function removePosition(id: string) {
    setPositions((prev) => prev.filter((p) => p.id !== id));
  }

  function updatePosition(id: string, field: keyof Position, value: string | number) {
    setPositions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: typeof value === 'string' && field !== 'pair' ? parseFloat(value) || 0 : value } : p))
    );
  }

  function calculate() {
    setResults(computeMockResults(positions));
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Position Input */}
      <div className="w-[520px] shrink-0 border-r border-[#1f1f1f] flex flex-col bg-[#0d0d0d]">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1f1f1f] shrink-0">
          <span className="font-mono text-[10px] tracking-widest text-[#888888] uppercase">Position Risk Calculator</span>
          <button
            onClick={addPosition}
            className="flex items-center gap-1 font-mono text-[9px] text-[#ff6600] hover:bg-[#ff6600]/10 px-2 py-1 rounded transition-colors"
          >
            <Plus size={12} />
            ADD POSITION
          </button>
        </div>

        {/* Column Headers */}
        <div className="grid grid-cols-[90px_48px_72px_72px_80px_48px_24px] gap-1.5 px-3 py-1.5 border-b border-[#1f1f1f] shrink-0">
          {['PAIR', 'LOTS', 'ENTRY', 'STOP', 'ACCOUNT $', 'RISK%', ''].map((h) => (
            <span key={h} className="font-mono text-[8px] text-[#444444] tracking-widest uppercase">{h}</span>
          ))}
        </div>

        {/* Position Rows */}
        <div className="flex-1 overflow-auto py-1">
          {positions.map((pos) => (
            <div key={pos.id} className="grid grid-cols-[90px_48px_72px_72px_80px_48px_24px] gap-1.5 px-3 py-1.5 border-b border-[#111111] items-center">
              {/* Pair dropdown */}
              <select
                value={pos.pair}
                onChange={(e) => updatePosition(pos.id, 'pair', e.target.value)}
                className="bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[#e8e8e8] font-mono text-[9px] px-1.5 py-1 w-full focus:border-[#ff6600] focus:outline-none"
              >
                {PAIRS.map((p) => <option key={p}>{p}</option>)}
              </select>

              {/* Lots */}
              <input
                type="number"
                value={pos.lots}
                step="0.1"
                min="0.01"
                onChange={(e) => updatePosition(pos.id, 'lots', e.target.value)}
                className="bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[#e8e8e8] font-mono text-[9px] px-1.5 py-1 w-full focus:border-[#ff6600] focus:outline-none tabular-nums"
              />

              {/* Entry */}
              <input
                type="number"
                value={pos.entry}
                step="0.0001"
                onChange={(e) => updatePosition(pos.id, 'entry', e.target.value)}
                className="bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[#e8e8e8] font-mono text-[9px] px-1.5 py-1 w-full focus:border-[#ff6600] focus:outline-none tabular-nums"
              />

              {/* Stop Loss */}
              <input
                type="number"
                value={pos.sl}
                step="0.0001"
                onChange={(e) => updatePosition(pos.id, 'sl', e.target.value)}
                className="bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[#ff3b3b] font-mono text-[9px] px-1.5 py-1 w-full focus:border-[#ff6600] focus:outline-none tabular-nums"
              />

              {/* Account */}
              <input
                type="number"
                value={pos.accountSize}
                step="1000"
                onChange={(e) => updatePosition(pos.id, 'accountSize', e.target.value)}
                className="bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[#e8e8e8] font-mono text-[9px] px-1.5 py-1 w-full focus:border-[#ff6600] focus:outline-none tabular-nums"
              />

              {/* Risk % */}
              <input
                type="number"
                value={pos.riskPct}
                step="0.1"
                min="0.1"
                max="5"
                onChange={(e) => updatePosition(pos.id, 'riskPct', e.target.value)}
                className="bg-[#1a1a1a] border border-[#2a2a2a] rounded text-[#e8e8e8] font-mono text-[9px] px-1.5 py-1 w-full focus:border-[#ff6600] focus:outline-none tabular-nums"
              />

              {/* Remove */}
              <button
                onClick={() => removePosition(pos.id)}
                disabled={positions.length === 1}
                className="text-[#444444] hover:text-[#ff3b3b] transition-colors disabled:opacity-30"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>

        {/* Calculate Button */}
        <div className="px-4 py-3 border-t border-[#1f1f1f] shrink-0">
          <button
            onClick={calculate}
            className="w-full bg-[#ff6600] hover:bg-[#ff6600]/90 text-black font-mono text-[11px] font-bold tracking-widest py-2.5 rounded transition-colors uppercase"
          >
            Calculate Risk
          </button>
        </div>
      </div>

      {/* Right: Results */}
      <div className="flex-1 overflow-auto bg-[#0a0a0a]">
        {!results ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl mb-3">⚖️</div>
              <div className="font-mono text-[#888888] text-sm">Enter positions and click Calculate Risk</div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Exposure Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#0d0d0d] border border-[#1f1f1f] rounded p-3">
                <div className="font-mono text-[9px] text-[#888888] tracking-widest uppercase mb-1">Total Exposure</div>
                <div className="font-mono text-lg font-bold text-[#e8e8e8] tabular-nums">${results.total_exposure_usd.toLocaleString()}</div>
              </div>
              <div className="bg-[#0d0d0d] border border-[#1f1f1f] rounded p-3">
                <div className="font-mono text-[9px] text-[#888888] tracking-widest uppercase mb-1">Gold Exposure</div>
                <div className="font-mono text-lg font-bold text-[#FFD700] tabular-nums">${results.gold_exposure.toLocaleString()}</div>
                <div className="font-mono text-[9px] text-[#444444]">{((results.gold_exposure / results.total_exposure_usd) * 100).toFixed(1)}% of total</div>
              </div>
              <div className="bg-[#0d0d0d] border border-[#1f1f1f] rounded p-3">
                <div className="font-mono text-[9px] text-[#888888] tracking-widest uppercase mb-1">Concentration Risk</div>
                <div className="mt-1"><ConcentrationBadge level={results.concentration_risk} /></div>
              </div>
            </div>

            {/* VaR Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0d0d0d] border border-[#1f1f1f] rounded p-3">
                <div className="font-mono text-[9px] text-[#888888] tracking-widest uppercase mb-1">VaR (95%)</div>
                <div className="font-mono text-xl font-bold text-[#ff3b3b] tabular-nums">${results.portfolio_var_95.toFixed(0)}</div>
                <div className="font-mono text-[9px] text-[#444444]">1-day 95% Value at Risk</div>
              </div>
              <div className="bg-[#0d0d0d] border border-[#1f1f1f] rounded p-3">
                <div className="font-mono text-[9px] text-[#888888] tracking-widest uppercase mb-1">VaR (99%)</div>
                <div className="font-mono text-xl font-bold text-[#ff3b3b] tabular-nums">${results.portfolio_var_99.toFixed(0)}</div>
                <div className="font-mono text-[9px] text-[#444444]">1-day 99% Value at Risk</div>
              </div>
            </div>

            {/* Correlation Heatmap */}
            <div className="bg-[#0d0d0d] border border-[#1f1f1f] rounded p-4">
              <CorrelationHeatmap matrix={results.correlation_matrix} />
            </div>

            {/* Position Sizing Recommendations */}
            <div className="bg-[#0d0d0d] border border-[#1f1f1f] rounded p-4">
              <div className="font-mono text-[9px] text-[#888888] tracking-widest uppercase mb-3">Position Sizing Recommendations</div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1f1f1f]">
                    {['Pair', 'Input Lots', 'Recommended Lots', 'Max Lots (2% Risk)'].map((h) => (
                      <th key={h} className="text-left font-mono text-[8px] text-[#444444] tracking-widest uppercase pb-2 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.position_sizes.map((row, i) => (
                    <tr key={row.pair + i} className="border-b border-[#111111]">
                      <td className="font-mono text-[10px] text-[#ff6600] py-2 pr-4">{row.pair}</td>
                      <td className="font-mono text-[10px] text-[#888888] py-2 pr-4 tabular-nums">{positions[i]?.lots ?? '-'}</td>
                      <td className="font-mono text-[10px] text-[#00d37f] py-2 pr-4 tabular-nums">{row.recommended_lots}</td>
                      <td className="font-mono text-[10px] text-[#888888] py-2 tabular-nums">{row.max_lots}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Risk Warnings */}
            {results.risk_warnings.length > 0 && (
              <div className="bg-[#0d0d0d] border border-[#ff3b3b]/30 rounded p-4">
                <div className="font-mono text-[9px] text-[#ff3b3b] tracking-widest uppercase mb-2">Risk Warnings</div>
                <div className="space-y-1.5">
                  {results.risk_warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-[#ff3b3b] shrink-0 mt-0.5">⚠</span>
                      <span className="font-mono text-[10px] text-[#888888]">{w}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
