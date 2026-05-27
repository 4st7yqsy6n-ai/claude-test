import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { fetchBacktest, type BacktestResult } from '@/lib/api';

// ─── Inline Mock Data ─────────────────────────────────────────────────────────

function generateEquityCurve(start: number, trades: number, winRate: number): Array<{ date: string; equity: number }> {
  const result: Array<{ date: string; equity: number }> = [];
  let equity = start;
  const now = new Date();
  for (let i = trades; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 2);
    const won = Math.random() < winRate;
    equity += won ? equity * (Math.random() * 0.018 + 0.005) : -equity * (Math.random() * 0.012 + 0.003);
    result.push({ date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), equity: Math.max(equity, 1000) });
  }
  return result;
}

function generateMonthlyReturns(winRate: number, volatility: number): Array<{ month: string; return: number }> {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months.map((month) => ({
    month,
    return: (Math.random() < winRate ? 1 : -1) * (Math.random() * volatility * 100),
  }));
}

const MOCK_STRATEGIES: Record<string, BacktestResult> = {
  gold_mean_reversion: {
    strategy_name: 'gold_mean_reversion', display_name: 'Gold Mean Reversion', description: 'Identifies overbought/oversold conditions in gold using RSI + Bollinger Bands within the macro regime context. Trades mean-reversion setups with tight risk management.',
    parameters: { rsi_period: 14, bb_std: 2.0, hold_bars: 8 }, period: '2020–2024', total_trades: 187, win_rate: 0.58, profit_factor: 1.74, sharpe_ratio: 1.42, max_drawdown: -12.3, net_pnl_pct: 47.8, avg_trade_pnl: 0.26, best_trade: 3.4, worst_trade: -2.1, avg_hold_bars: 8,
    equity_curve: generateEquityCurve(10000, 187, 0.58), monthly_returns: generateMonthlyReturns(0.58, 3.5),
    trade_distribution: [{ bucket: '-3%+', count: 8 }, { bucket: '-2 to -3%', count: 18 }, { bucket: '-1 to -2%', count: 31 }, { bucket: '0 to -1%', count: 22 }, { bucket: '0 to 1%', count: 41 }, { bucket: '1 to 2%', count: 38 }, { bucket: '2 to 3%', count: 21 }, { bucket: '3%+', count: 8 }],
    regime_breakdown: [{ regime: 'Risk-Off+HI', trades: 68, win_rate: 0.68, avg_pnl: 0.45 }, { regime: 'Risk-On+DI', trades: 54, win_rate: 0.52, avg_pnl: 0.12 }, { regime: 'Neutral', trades: 65, win_rate: 0.55, avg_pnl: 0.22 }],
    pair: 'XAU/USD', timeframe: 'H4',
  },
  fx_momentum_nfp: {
    strategy_name: 'fx_momentum_nfp', display_name: 'FX Momentum (NFP)', description: 'Capitalizes on post-NFP momentum moves in USD pairs. Enters 30min after release in direction of initial move, filtering for regime alignment. Targets 3:1 R:R setups.',
    parameters: { entry_delay_min: 30, momentum_threshold: 0.3, max_hold_hrs: 24 }, period: '2020–2024', total_trades: 142, win_rate: 0.62, profit_factor: 2.18, sharpe_ratio: 1.87, max_drawdown: -8.1, net_pnl_pct: 61.2, avg_trade_pnl: 0.43, best_trade: 4.1, worst_trade: -1.6, avg_hold_bars: 16,
    equity_curve: generateEquityCurve(10000, 142, 0.62), monthly_returns: generateMonthlyReturns(0.62, 4.1),
    trade_distribution: [{ bucket: '-3%+', count: 3 }, { bucket: '-2 to -3%', count: 9 }, { bucket: '-1 to -2%', count: 22 }, { bucket: '0 to -1%', count: 20 }, { bucket: '0 to 1%', count: 25 }, { bucket: '1 to 2%', count: 32 }, { bucket: '2 to 3%', count: 21 }, { bucket: '3%+', count: 10 }],
    regime_breakdown: [{ regime: 'Risk-Off+HI', trades: 48, win_rate: 0.71, avg_pnl: 0.62 }, { regime: 'Risk-On+DI', trades: 52, win_rate: 0.58, avg_pnl: 0.31 }, { regime: 'Neutral', trades: 42, win_rate: 0.57, avg_pnl: 0.28 }],
    pair: 'EUR/USD, USD/JPY', timeframe: 'H1',
  },
  carry_trade: {
    strategy_name: 'carry_trade', display_name: 'Carry Trade', description: 'Systematic interest rate differential harvesting across G10 pairs. Long high-yield, short low-yield with regime overlay to avoid carrying into risk-off environments.',
    parameters: { min_rate_diff: 1.5, regime_filter: true, rebalance_freq: 'weekly' }, period: '2020–2024', total_trades: 89, win_rate: 0.71, profit_factor: 2.84, sharpe_ratio: 2.14, max_drawdown: -6.8, net_pnl_pct: 74.3, avg_trade_pnl: 0.83, best_trade: 5.2, worst_trade: -2.8, avg_hold_bars: 120,
    equity_curve: generateEquityCurve(10000, 89, 0.71), monthly_returns: generateMonthlyReturns(0.71, 2.8),
    trade_distribution: [{ bucket: '-3%+', count: 2 }, { bucket: '-2 to -3%', count: 4 }, { bucket: '-1 to -2%', count: 8 }, { bucket: '0 to -1%', count: 12 }, { bucket: '0 to 1%', count: 18 }, { bucket: '1 to 2%', count: 22 }, { bucket: '2 to 3%', count: 16 }, { bucket: '3%+', count: 7 }],
    regime_breakdown: [{ regime: 'Risk-On', trades: 52, win_rate: 0.81, avg_pnl: 1.12 }, { regime: 'Neutral', trades: 37, win_rate: 0.59, avg_pnl: 0.42 }],
    pair: 'Multi-pair', timeframe: 'Daily',
  },
  volatility_breakout: {
    strategy_name: 'volatility_breakout', display_name: 'Volatility Breakout', description: 'Trades explosive breakouts following periods of compression (low ATR). Uses Bollinger Band squeeze + volume confirmation. Higher win rate but larger drawdowns.',
    parameters: { atr_period: 14, squeeze_bars: 20, vol_multiplier: 1.8 }, period: '2020–2024', total_trades: 223, win_rate: 0.51, profit_factor: 1.48, sharpe_ratio: 1.21, max_drawdown: -18.4, net_pnl_pct: 38.7, avg_trade_pnl: 0.17, best_trade: 6.8, worst_trade: -4.2, avg_hold_bars: 12,
    equity_curve: generateEquityCurve(10000, 223, 0.51), monthly_returns: generateMonthlyReturns(0.51, 5.2),
    trade_distribution: [{ bucket: '-3%+', count: 18 }, { bucket: '-2 to -3%', count: 26 }, { bucket: '-1 to -2%', count: 38 }, { bucket: '0 to -1%', count: 27 }, { bucket: '0 to 1%', count: 42 }, { bucket: '1 to 2%', count: 38 }, { bucket: '2 to 3%', count: 22 }, { bucket: '3%+', count: 12 }],
    regime_breakdown: [{ regime: 'High Vol', trades: 91, win_rate: 0.57, avg_pnl: 0.32 }, { regime: 'Low Vol', trades: 132, win_rate: 0.47, avg_pnl: 0.06 }],
    pair: 'XAU/USD, EUR/USD', timeframe: 'H1',
  },
  gold_macro_filter: {
    strategy_name: 'gold_macro_filter', display_name: 'Gold Macro Filter', description: 'Pure macro-driven gold trading. Only enters gold positions when all three macro signals align: risk-off + high inflation + weak dollar. Extremely selective, high conviction trades only.',
    parameters: { regime_threshold: 0.85, confirmation_bars: 3, macro_weight: true }, period: '2020–2024', total_trades: 94, win_rate: 0.65, profit_factor: 2.31, sharpe_ratio: 1.73, max_drawdown: -9.2, net_pnl_pct: 58.4, avg_trade_pnl: 0.62, best_trade: 4.8, worst_trade: -2.3, avg_hold_bars: 32,
    equity_curve: generateEquityCurve(10000, 94, 0.65), monthly_returns: generateMonthlyReturns(0.65, 3.2),
    trade_distribution: [{ bucket: '-3%+', count: 4 }, { bucket: '-2 to -3%', count: 8 }, { bucket: '-1 to -2%', count: 14 }, { bucket: '0 to -1%', count: 7 }, { bucket: '0 to 1%', count: 19 }, { bucket: '1 to 2%', count: 22 }, { bucket: '2 to 3%', count: 14 }, { bucket: '3%+', count: 6 }],
    regime_breakdown: [{ regime: 'Full Align', trades: 58, win_rate: 0.76, avg_pnl: 0.88 }, { regime: 'Partial', trades: 36, win_rate: 0.47, avg_pnl: 0.21 }],
    pair: 'XAU/USD', timeframe: 'H4/D1',
  },
};

const STRATEGY_LIST = [
  { key: 'gold_mean_reversion', icon: '🥇', label: 'Gold Mean Reversion' },
  { key: 'fx_momentum_nfp', icon: '📈', label: 'FX Momentum (NFP)' },
  { key: 'carry_trade', icon: '💱', label: 'Carry Trade' },
  { key: 'volatility_breakout', icon: '⚡', label: 'Volatility Breakout' },
  { key: 'gold_macro_filter', icon: '🌍', label: 'Gold Macro Filter' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, color = '#e8e8e8', sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="bg-[#111111] border border-[#1f1f1f] rounded p-3">
      <div className="font-mono text-[9px] text-[#888888] tracking-widest uppercase mb-1">{label}</div>
      <div className="font-mono text-xl font-bold tabular-nums" style={{ color }}>{value}</div>
      {sub && <div className="font-mono text-[9px] text-[#444444] mt-0.5">{sub}</div>}
    </div>
  );
}

function MonthlyReturnsHeatmap({ data }: { data: Array<{ month: string; return: number }> }) {
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.return)), 1);
  return (
    <div>
      <div className="font-mono text-[9px] text-[#888888] tracking-widest uppercase mb-2">Monthly Returns</div>
      <div className="grid grid-cols-6 gap-1">
        {data.map((d) => {
          const intensity = Math.min(Math.abs(d.return) / maxAbs, 1);
          const isPos = d.return >= 0;
          const bg = isPos
            ? `rgba(0, 211, 127, ${0.15 + intensity * 0.7})`
            : `rgba(255, 59, 59, ${0.15 + intensity * 0.7})`;
          return (
            <div key={d.month} className="rounded p-1.5 text-center" style={{ backgroundColor: bg }}>
              <div className="font-mono text-[8px] text-[#888888]">{d.month}</div>
              <div className={`font-mono text-[9px] font-bold tabular-nums ${isPos ? 'text-[#00d37f]' : 'text-[#ff3b3b]'}`}>
                {isPos ? '+' : ''}{d.return.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-4 animate-pulse">
      <div className="grid grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 bg-[#1a1a1a] rounded" />
        ))}
      </div>
      <div className="h-48 bg-[#1a1a1a] rounded" />
      <div className="h-32 bg-[#1a1a1a] rounded" />
    </div>
  );
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) {
  if (active && payload?.length) {
    return (
      <div className="bg-[#111111] border border-[#1f1f1f] rounded px-2 py-1.5">
        <span className="font-mono text-[10px] text-[#e8e8e8] tabular-nums">${payload[0].value.toFixed(0)}</span>
      </div>
    );
  }
  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StrategyLab() {
  const [selectedStrategy, setSelectedStrategy] = useState('gold_mean_reversion');

  const { data: fetchedData, isLoading } = useQuery({
    queryKey: ['backtest', selectedStrategy],
    queryFn: () => fetchBacktest(selectedStrategy),
    staleTime: 5 * 60_000,
    refetchInterval: 60_000,
  });

  const result: BacktestResult = fetchedData ?? MOCK_STRATEGIES[selectedStrategy];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Sidebar: Strategy Selector */}
      <div className="w-52 shrink-0 bg-[#0d0d0d] border-r border-[#1f1f1f] flex flex-col">
        <div className="px-4 py-2.5 border-b border-[#1f1f1f]">
          <span className="font-mono text-[10px] tracking-widest text-[#888888] uppercase">Strategies</span>
        </div>
        <nav className="flex-1 py-2">
          {STRATEGY_LIST.map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => setSelectedStrategy(key)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-all relative ${
                selectedStrategy === key
                  ? 'bg-[#ff6600]/10 text-[#e8e8e8]'
                  : 'text-[#888888] hover:bg-[#111111] hover:text-[#e8e8e8]'
              }`}
            >
              {selectedStrategy === key && (
                <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-[#ff6600] rounded-r" />
              )}
              <span className="text-base">{icon}</span>
              <span className="font-mono text-[10px] leading-tight">{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Right: Results */}
      <div className="flex-1 overflow-auto bg-[#0a0a0a]">
        {isLoading && !result ? (
          <LoadingSkeleton />
        ) : (
          <div className="p-4 space-y-5">
            {/* Title + Description */}
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="font-mono text-sm font-bold text-[#e8e8e8] uppercase tracking-wider">{result.display_name}</h2>
                <span className="font-mono text-[9px] text-[#888888] bg-[#1a1a1a] px-2 py-0.5 rounded">{result.pair}</span>
                <span className="font-mono text-[9px] text-[#888888] bg-[#1a1a1a] px-2 py-0.5 rounded">{result.timeframe}</span>
                <span className="font-mono text-[9px] text-[#444444] bg-[#111111] px-2 py-0.5 rounded">{result.period}</span>
              </div>
              <p className="font-mono text-[10px] text-[#888888] leading-relaxed max-w-2xl">{result.description}</p>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
              <MetricCard label="Win Rate" value={`${(result.win_rate * 100).toFixed(1)}%`} color={result.win_rate >= 0.6 ? '#00d37f' : result.win_rate >= 0.5 ? '#f59e0b' : '#ff3b3b'} sub={`${result.total_trades} trades`} />
              <MetricCard label="Profit Factor" value={result.profit_factor.toFixed(2)} color={result.profit_factor >= 2 ? '#00d37f' : result.profit_factor >= 1.5 ? '#f59e0b' : '#ff3b3b'} />
              <MetricCard label="Sharpe Ratio" value={result.sharpe_ratio.toFixed(2)} color={result.sharpe_ratio >= 1.5 ? '#00d37f' : result.sharpe_ratio >= 1 ? '#f59e0b' : '#ff3b3b'} />
              <MetricCard label="Max Drawdown" value={`${result.max_drawdown.toFixed(1)}%`} color="#ff3b3b" />
              <MetricCard label="Net P&L" value={`+${result.net_pnl_pct.toFixed(1)}%`} color="#00d37f" sub={result.period} />
              <MetricCard label="Avg Hold" value={`${result.avg_hold_bars} bars`} color="#888888" />
            </div>

            {/* Equity Curve */}
            <div className="bg-[#0d0d0d] border border-[#1f1f1f] rounded p-4">
              <div className="font-mono text-[9px] text-[#888888] tracking-widest uppercase mb-3">Equity Curve</div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={result.equity_curve} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                    <defs>
                      <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FFD700" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="#1a1a1a" />
                    <XAxis dataKey="date" tick={{ fill: '#444444', fontSize: 8, fontFamily: 'monospace' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#444444', fontSize: 8, fontFamily: 'monospace' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} width={40} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="equity" stroke="#FFD700" strokeWidth={1.5} fill="url(#equityGradient)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly Returns + Trade Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Monthly Returns Heatmap */}
              <div className="bg-[#0d0d0d] border border-[#1f1f1f] rounded p-4">
                <MonthlyReturnsHeatmap data={result.monthly_returns} />
              </div>

              {/* Trade Distribution */}
              <div className="bg-[#0d0d0d] border border-[#1f1f1f] rounded p-4">
                <div className="font-mono text-[9px] text-[#888888] tracking-widest uppercase mb-3">Trade Distribution</div>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={result.trade_distribution} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                      <XAxis dataKey="bucket" tick={{ fill: '#444444', fontSize: 7, fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#444444', fontSize: 7, fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={24} />
                      <Tooltip contentStyle={{ background: '#111111', border: '1px solid #1f1f1f', borderRadius: 4, fontFamily: 'monospace', fontSize: 10 }} cursor={{ fill: '#ffffff08' }} />
                      <Bar dataKey="count" fill="#ff6600" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Regime Breakdown */}
            <div className="bg-[#0d0d0d] border border-[#1f1f1f] rounded p-4">
              <div className="font-mono text-[9px] text-[#888888] tracking-widest uppercase mb-3">Regime Breakdown</div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1f1f1f]">
                      {['Regime', 'Trades', 'Win Rate', 'Avg P&L'].map((h) => (
                        <th key={h} className="text-left font-mono text-[8px] text-[#444444] tracking-widest uppercase pb-2 pr-6">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.regime_breakdown.map((row) => (
                      <tr key={row.regime} className="border-b border-[#111111]">
                        <td className="font-mono text-[10px] text-[#e8e8e8] py-2 pr-6">{row.regime}</td>
                        <td className="font-mono text-[10px] text-[#888888] py-2 pr-6 tabular-nums">{row.trades}</td>
                        <td className="py-2 pr-6">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-[#00d37f]" style={{ width: `${row.win_rate * 100}%` }} />
                            </div>
                            <span className="font-mono text-[9px] text-[#00d37f] tabular-nums">{(row.win_rate * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className={`font-mono text-[10px] tabular-nums py-2 ${row.avg_pnl >= 0 ? 'text-[#00d37f]' : 'text-[#ff3b3b]'}`}>
                          {row.avg_pnl >= 0 ? '+' : ''}{row.avg_pnl.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
