import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { fetchVIPScenarios, type VIPScenario } from '@/lib/api';

// ─── Inline Mock Scenarios ────────────────────────────────────────────────────

const MOCK_SCENARIOS: VIPScenario[] = [
  {
    scenario_id: 'cpi_surprise',
    name: 'CPI +30bps Surprise',
    category: 'inflation',
    description: 'US CPI prints 30bps above consensus, reigniting inflation fears and pushing Fed rate cut expectations back further.',
    probability: 0.35,
    impact: {
      'XAU/USD': { direction: 'UP', expected_move_pct: 1.8, confidence: 'HIGH' },
      'USD/JPY': { direction: 'DOWN', expected_move_pct: -0.9, confidence: 'HIGH' },
      'EUR/USD': { direction: 'DOWN', expected_move_pct: -0.4, confidence: 'MEDIUM' },
      'GBP/USD': { direction: 'DOWN', expected_move_pct: -0.3, confidence: 'MEDIUM' },
      'AUD/USD': { direction: 'DOWN', expected_move_pct: -0.5, confidence: 'MEDIUM' },
    },
    key_levels: { 'XAU/USD': 2680, 'USD/JPY': 156.50, 'EUR/USD': 1.0780 },
    trading_playbook: 'LONG XAU/USD at market open on release, target 2680. SHORT USD/JPY from 158.00 area. Avoid EUR/USD — crosscurrents too complex. Size: 75% of normal position given event risk.',
    historical_analog: 'March 2024 CPI surprise: Gold surged +1.6% intraday, USD/JPY fell 1.2% within 2 hours of release.',
  },
  {
    scenario_id: 'fed_emergency_cut',
    name: 'Fed Emergency Cut',
    category: 'policy',
    description: 'Federal Reserve announces an emergency 50bps rate cut citing deteriorating economic conditions or financial stability concerns.',
    probability: 0.15,
    impact: {
      'XAU/USD': { direction: 'UP', expected_move_pct: 3.2, confidence: 'HIGH' },
      'EUR/USD': { direction: 'UP', expected_move_pct: 1.4, confidence: 'HIGH' },
      'USD/JPY': { direction: 'DOWN', expected_move_pct: -2.1, confidence: 'HIGH' },
      'AUD/USD': { direction: 'UP', expected_move_pct: 1.1, confidence: 'MEDIUM' },
      'GBP/USD': { direction: 'UP', expected_move_pct: 0.9, confidence: 'MEDIUM' },
    },
    key_levels: { 'XAU/USD': 2750, 'USD/JPY': 152.00, 'EUR/USD': 1.1050 },
    trading_playbook: 'MAXIMUM LONG XAU/USD. LONG EUR/USD, GBP/USD. SHORT USD/JPY aggressively. This is a once-in-cycle macro shift — full risk deployment warranted with trailing stops.',
    historical_analog: 'COVID emergency cut March 2020: Gold initially fell on liquidity crunch, then surged +25% over following months. Don\'t chase the initial move.',
  },
  {
    scenario_id: 'risk_off_vix35',
    name: 'Risk-Off Spike VIX>35',
    category: 'risk',
    description: 'Market-wide risk-off event drives VIX above 35, triggering broad deleveraging. Could be triggered by geopolitical shock, credit event, or earnings collapse.',
    probability: 0.25,
    impact: {
      'XAU/USD': { direction: 'UP', expected_move_pct: 2.4, confidence: 'HIGH' },
      'USD/JPY': { direction: 'DOWN', expected_move_pct: -1.8, confidence: 'HIGH' },
      'AUD/USD': { direction: 'DOWN', expected_move_pct: -2.1, confidence: 'HIGH' },
      'EUR/USD': { direction: 'DOWN', expected_move_pct: -0.8, confidence: 'MEDIUM' },
      'GBP/USD': { direction: 'DOWN', expected_move_pct: -1.2, confidence: 'MEDIUM' },
    },
    key_levels: { 'XAU/USD': 2720, 'USD/JPY': 153.50, 'AUD/USD': 0.6200 },
    trading_playbook: 'LONG XAU/USD (safe haven). SHORT AUD/USD (risk-off proxy). SHORT USD/JPY (JPY safe haven flows). AVOID buying equities on dip until VIX < 25. Hold positions for 3-5 days minimum.',
    historical_analog: 'August 2024 yen carry unwind: USD/JPY fell -10% in 3 weeks, gold held firm while AUD/USD dropped -4%. Perfect playbook validation.',
  },
  {
    scenario_id: 'usd_surge_dxy108',
    name: 'USD Surge DXY>108',
    category: 'policy',
    description: 'US Dollar Index breaks above 108 driven by hawkish Fed repricing, strong US data, and global growth divergence. Strong dollar headwind for all risk assets.',
    probability: 0.20,
    impact: {
      'XAU/USD': { direction: 'DOWN', expected_move_pct: -2.1, confidence: 'HIGH' },
      'EUR/USD': { direction: 'DOWN', expected_move_pct: -1.8, confidence: 'HIGH' },
      'GBP/USD': { direction: 'DOWN', expected_move_pct: -1.5, confidence: 'HIGH' },
      'AUD/USD': { direction: 'DOWN', expected_move_pct: -2.4, confidence: 'HIGH' },
      'USD/JPY': { direction: 'UP', expected_move_pct: 1.6, confidence: 'MEDIUM' },
    },
    key_levels: { 'XAU/USD': 2500, 'EUR/USD': 1.0480, 'AUD/USD': 0.6100 },
    trading_playbook: 'REDUCE all non-USD long positions. SHORT AUD/USD as the highest beta risk currency. SHORT XAU/USD cautiously (central bank buying provides floor). LONG USD/JPY if BoJ stays passive.',
    historical_analog: 'Q4 2022 DXY surge to 115: Gold fell from $1800 to $1620 (-10%), EUR/USD reached parity, AUD fell to 0.62.',
  },
  {
    scenario_id: 'boj_pivot',
    name: 'BoJ Hawkish Pivot',
    category: 'policy',
    description: 'Bank of Japan surprises with rate hike or signals end of yield curve control, triggering massive JPY repatriation and carry trade unwind.',
    probability: 0.30,
    impact: {
      'USD/JPY': { direction: 'DOWN', expected_move_pct: -3.5, confidence: 'HIGH' },
      'EUR/JPY': { direction: 'DOWN', expected_move_pct: -3.8, confidence: 'HIGH' },
      'XAU/USD': { direction: 'UP', expected_move_pct: 0.8, confidence: 'MEDIUM' },
      'AUD/USD': { direction: 'DOWN', expected_move_pct: -1.4, confidence: 'MEDIUM' },
      'EUR/USD': { direction: 'DOWN', expected_move_pct: -0.5, confidence: 'LOW' },
    },
    key_levels: { 'USD/JPY': 150.00, 'EUR/JPY': 163.00, 'XAU/USD': 2650 },
    trading_playbook: 'SHORT USD/JPY is the primary trade — this is directional and high conviction. SHORT EUR/JPY for carry unwind. LONG gold as safe haven. Expect very fast moves — use options if available for asymmetric payoff.',
    historical_analog: 'July 2024 BoJ rate hike surprise: USD/JPY fell from 161 to 142 in 3 weeks. Carry trades globally suffered -5 to -15%.',
  },
  {
    scenario_id: 'oil_collapse',
    name: 'Oil Price Collapse',
    category: 'geopolitical',
    description: 'Oil prices drop >20% within a month due to OPEC+ breakdown, demand destruction, or geopolitical resolution reducing supply premium.',
    probability: 0.20,
    impact: {
      'USD/CAD': { direction: 'UP', expected_move_pct: 1.8, confidence: 'HIGH' },
      'AUD/USD': { direction: 'DOWN', expected_move_pct: -0.9, confidence: 'MEDIUM' },
      'XAU/USD': { direction: 'UP', expected_move_pct: 0.4, confidence: 'LOW' },
      'EUR/USD': { direction: 'UP', expected_move_pct: 0.3, confidence: 'LOW' },
      'USD/NOK': { direction: 'UP', expected_move_pct: 2.8, confidence: 'HIGH' },
    },
    key_levels: { 'USD/CAD': 1.3900, 'AUD/USD': 0.6350, 'XAU/USD': 2640 },
    trading_playbook: 'LONG USD/CAD is the clearest expression. SHORT AUD/USD as commodity currency. Gold is marginally bullish on deflation fears but not the primary trade. Position size: 50% — oil collapse scenarios have complex knock-on effects.',
    historical_analog: 'COVID demand collapse 2020: USD/CAD surged from 1.33 to 1.45 (+9%). WTI went negative briefly — CAD was most impacted G10 currency.',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  inflation: { bg: '#ff6600/10', text: '#ff6600', border: '#ff6600/30' },
  policy: { bg: 'rgba(59,130,246,0.1)', text: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
  risk: { bg: 'rgba(255,59,59,0.1)', text: '#ff3b3b', border: 'rgba(255,59,59,0.3)' },
  geopolitical: { bg: 'rgba(168,85,247,0.1)', text: '#a855f7', border: 'rgba(168,85,247,0.3)' },
};

function ProbabilityGauge({ prob }: { prob: number }) {
  const pct = Math.round(prob * 100);
  const color = pct >= 40 ? '#ff3b3b' : pct >= 25 ? '#f59e0b' : '#888888';
  const circumference = 2 * Math.PI * 24;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="24" fill="none" stroke="#1a1a1a" strokeWidth="6" />
        <circle
          cx="32" cy="32" r="24"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
        />
        <text x="32" y="37" textAnchor="middle" fill={color} fontSize="12" fontFamily="monospace" fontWeight="bold">
          {pct}%
        </text>
      </svg>
      <span className="font-mono text-[8px] text-[#444444] tracking-widest">PROB</span>
    </div>
  );
}

function ScenarioCard({ scenario, onClick }: { scenario: VIPScenario; onClick: () => void }) {
  const cat = CATEGORY_COLORS[scenario.category] ?? CATEGORY_COLORS.policy;

  return (
    <button
      onClick={onClick}
      className="bg-[#0d0d0d] border border-[#1f1f1f] rounded p-4 text-left hover:border-[#2a2a2a] hover:bg-[#111111] transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div
            className="inline-block font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded mb-1.5"
            style={{ backgroundColor: cat.bg, color: cat.text, border: `1px solid ${cat.border}` }}
          >
            {scenario.category}
          </div>
          <h3 className="font-mono text-[11px] font-bold text-[#e8e8e8] leading-tight">{scenario.name}</h3>
        </div>
        <ProbabilityGauge prob={scenario.probability} />
      </div>

      <p className="font-mono text-[9px] text-[#888888] leading-relaxed line-clamp-3">{scenario.description}</p>

      <div className="mt-3 flex items-center gap-2 border-t border-[#1a1a1a] pt-2">
        <span className="font-mono text-[8px] text-[#444444] tracking-widest">TOP IMPACT:</span>
        {Object.entries(scenario.impact).slice(0, 2).map(([pair, imp]) => (
          <span key={pair} className={`font-mono text-[8px] ${imp.direction === 'UP' ? 'text-[#00d37f]' : 'text-[#ff3b3b]'}`}>
            {pair} {imp.direction === 'UP' ? '▲' : '▼'}{Math.abs(imp.expected_move_pct).toFixed(1)}%
          </span>
        ))}
      </div>
    </button>
  );
}

function ScenarioDetail({ scenario, onClose }: { scenario: VIPScenario; onClose: () => void }) {
  const cat = CATEGORY_COLORS[scenario.category] ?? CATEGORY_COLORS.policy;
  const prob = Math.round(scenario.probability * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1f1f1f] shrink-0">
          <div className="flex items-center gap-3">
            <span
              className="font-mono text-[8px] tracking-widest uppercase px-1.5 py-0.5 rounded"
              style={{ backgroundColor: cat.bg, color: cat.text, border: `1px solid ${cat.border}` }}
            >
              {scenario.category}
            </span>
            <h2 className="font-mono text-sm font-bold text-[#e8e8e8]">{scenario.name}</h2>
            <span className="font-mono text-[10px] text-[#888888]">{prob}% probability</span>
          </div>
          <button onClick={onClose} className="text-[#888888] hover:text-[#e8e8e8] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5 space-y-5">
          {/* Description */}
          <p className="font-mono text-[10px] text-[#888888] leading-relaxed">{scenario.description}</p>

          {/* Impact Table */}
          <div>
            <div className="font-mono text-[9px] text-[#ff6600] tracking-widest uppercase mb-2">Market Impact</div>
            <div className="bg-[#111111] border border-[#1f1f1f] rounded overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1f1f1f]">
                    {['Pair', 'Direction', 'Expected Move', 'Confidence'].map((h) => (
                      <th key={h} className="text-left font-mono text-[8px] text-[#444444] tracking-widest uppercase px-3 py-2 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="px-3">
                  {Object.entries(scenario.impact).map(([pair, imp]) => (
                    <tr key={pair} className="border-b border-[#0d0d0d] last:border-0">
                      <td className="font-mono text-[10px] text-[#ff6600] px-3 py-2 pr-4">{pair}</td>
                      <td className="px-3 py-2 pr-4">
                        <span className={`font-mono text-sm font-bold ${imp.direction === 'UP' ? 'text-[#00d37f]' : 'text-[#ff3b3b]'}`}>
                          {imp.direction === 'UP' ? '▲' : '▼'}
                        </span>
                      </td>
                      <td className={`font-mono text-[10px] tabular-nums px-3 py-2 pr-4 ${imp.direction === 'UP' ? 'text-[#00d37f]' : 'text-[#ff3b3b]'}`}>
                        {imp.direction === 'UP' ? '+' : ''}{imp.expected_move_pct.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2">
                        <span className={`font-mono text-[8px] tracking-wider px-1.5 py-0.5 rounded ${
                          imp.confidence === 'HIGH' ? 'bg-[#00d37f]/20 text-[#00d37f]' :
                          imp.confidence === 'MEDIUM' ? 'bg-[#f59e0b]/20 text-[#f59e0b]' :
                          'bg-[#888888]/20 text-[#888888]'
                        }`}>
                          {imp.confidence}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Key Levels */}
          <div>
            <div className="font-mono text-[9px] text-[#888888] tracking-widest uppercase mb-2">Key Levels to Watch</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(scenario.key_levels).map(([pair, level]) => (
                <div key={pair} className="bg-[#111111] border border-[#1f1f1f] rounded px-3 py-1.5">
                  <span className="font-mono text-[9px] text-[#ff6600]">{pair}</span>
                  <span className="font-mono text-[9px] text-[#888888] mx-1">→</span>
                  <span className="font-mono text-[10px] text-[#e8e8e8] font-bold tabular-nums">{level}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trading Playbook */}
          <div>
            <div className="font-mono text-[9px] text-[#ff6600] tracking-widest uppercase mb-2">Trading Playbook</div>
            <div className="bg-[#111111] border border-[#ff6600]/20 rounded p-3">
              <p className="font-mono text-[10px] text-[#e8e8e8] leading-relaxed">{scenario.trading_playbook}</p>
            </div>
          </div>

          {/* Historical Analog */}
          <div>
            <div className="font-mono text-[9px] text-[#888888] tracking-widest uppercase mb-2">Historical Analog</div>
            <p className="font-mono text-[10px] text-[#888888] leading-relaxed italic">{scenario.historical_analog}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScenarioAnalysis() {
  const [selectedScenario, setSelectedScenario] = useState<VIPScenario | null>(null);

  const { data: fetchedScenarios } = useQuery({
    queryKey: ['vip-scenarios'],
    queryFn: fetchVIPScenarios,
    staleTime: 5 * 60_000,
    refetchInterval: 60_000,
  });

  const scenarios = (fetchedScenarios && fetchedScenarios.length > 0) ? fetchedScenarios : MOCK_SCENARIOS;

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1f1f1f] shrink-0">
        <span className="font-mono text-[10px] tracking-widest text-[#888888] uppercase">Scenario Analysis — Click Card for Full Detail</span>
        <div className="flex items-center gap-3">
          {(['inflation', 'policy', 'risk', 'geopolitical'] as const).map((cat) => {
            const c = CATEGORY_COLORS[cat];
            return (
              <span key={cat} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.text }} />
                <span className="font-mono text-[8px] text-[#444444] capitalize">{cat}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Scenario Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.scenario_id}
              scenario={scenario}
              onClick={() => setSelectedScenario(scenario)}
            />
          ))}
        </div>
      </div>

      {/* Detail Overlay */}
      {selectedScenario && (
        <ScenarioDetail
          scenario={selectedScenario}
          onClose={() => setSelectedScenario(null)}
        />
      )}
    </div>
  );
}
