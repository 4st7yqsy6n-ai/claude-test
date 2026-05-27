import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import type { VIPRegime } from '@/lib/api';

interface Props {
  regime: VIPRegime;
}

interface GaugeProps {
  label: string;
  score: number;
  color: string;
  sublabel: string;
}

function Gauge({ label, score, color, sublabel }: GaugeProps) {
  const data = [{ value: score, fill: color }];
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <RadialBarChart
          width={112}
          height={112}
          cx={56}
          cy={56}
          innerRadius={36}
          outerRadius={52}
          startAngle={225}
          endAngle={-45}
          data={data}
          barSize={10}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar
            background={{ fill: '#1a1a1a' }}
            dataKey="value"
            angleAxisId={0}
            cornerRadius={5}
          />
        </RadialBarChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-lg font-bold tabular-nums" style={{ color }}>{score}</span>
          <span className="font-mono text-[8px] text-[#888888] uppercase tracking-wider">/100</span>
        </div>
      </div>
      <div className="text-center mt-1">
        <div className="font-mono text-[9px] text-[#888888] tracking-widest uppercase">{label}</div>
        <div className="font-mono text-[10px] font-bold mt-0.5" style={{ color }}>{sublabel}</div>
      </div>
    </div>
  );
}

function getRiskColor(sentiment: VIPRegime['risk_sentiment']): string {
  if (sentiment === 'risk_on') return '#00d37f';
  if (sentiment === 'risk_off') return '#ff3b3b';
  return '#ff6600';
}

function getRiskLabel(sentiment: VIPRegime['risk_sentiment']): string {
  if (sentiment === 'risk_on') return 'RISK-ON';
  if (sentiment === 'risk_off') return 'RISK-OFF';
  return 'NEUTRAL';
}

function getInflationLabel(regime: VIPRegime['inflation_regime']): string {
  if (regime === 'high_inflation') return 'HIGH INFL';
  if (regime === 'disinflation') return 'DISINFL';
  if (regime === 'deflation') return 'DEFLATION';
  return 'STABLE';
}

function getInflationColor(regime: VIPRegime['inflation_regime']): string {
  if (regime === 'high_inflation') return '#ff3b3b';
  if (regime === 'disinflation') return '#00d37f';
  if (regime === 'deflation') return '#ff6600';
  return '#888888';
}

function getUSDLabel(cycle: VIPRegime['usd_cycle']): string {
  if (cycle === 'strong_dollar') return 'STRONG $';
  if (cycle === 'weak_dollar') return 'WEAK $';
  return 'NEUTRAL';
}

function getUSDColor(cycle: VIPRegime['usd_cycle']): string {
  if (cycle === 'strong_dollar') return '#ff3b3b';
  if (cycle === 'weak_dollar') return '#00d37f';
  return '#ff6600';
}

function getGoldBiasColor(bias: VIPRegime['gold_bias']): string {
  if (bias === 'bullish') return '#00d37f';
  if (bias === 'bearish') return '#ff3b3b';
  return '#ff6600';
}

export default function RegimeGauge({ regime }: Props) {
  const goldColor = getGoldBiasColor(regime.gold_bias);
  const now = new Date(regime.updated_at);
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="flex flex-col bg-[#0d0d0d] border border-[#1f1f1f] rounded-sm overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1f1f1f] shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-widest text-[#888888] uppercase">Macro Regime Detector</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00d37f] animate-pulse inline-block" />
          <span className="font-mono text-[9px] text-[#00d37f] tracking-widest">LIVE</span>
          <span className="font-mono text-[9px] text-[#444444]">{dateStr} {timeStr}</span>
        </div>
      </div>

      {/* Gold Bias Badge */}
      <div className="px-4 py-3 shrink-0">
        <div
          className="flex items-center justify-between rounded border px-4 py-2.5"
          style={{ borderColor: goldColor + '44', backgroundColor: goldColor + '11' }}
        >
          <div>
            <div className="font-mono text-[9px] text-[#888888] tracking-widest uppercase mb-0.5">Gold Directional Bias</div>
            <div className="font-mono text-xl font-bold tracking-widest" style={{ color: goldColor }}>
              {regime.gold_bias.toUpperCase()}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="font-mono text-[9px] text-[#888888]">BIAS SCORE</div>
            <div className="font-mono text-2xl font-bold tabular-nums" style={{ color: goldColor }}>
              {regime.gold_bias_score}
            </div>
            <div className="w-20 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${regime.gold_bias_score}%`, backgroundColor: goldColor }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Regime Label */}
      <div className="px-4 pb-3 shrink-0">
        <div className="bg-[#111111] border border-[#2a2a2a] rounded px-3 py-2">
          <div className="font-mono text-[9px] text-[#ff6600] tracking-widest uppercase mb-1">Current Regime</div>
          <div className="font-mono text-[11px] text-[#e8e8e8] leading-snug">{regime.regime_label}</div>
        </div>
      </div>

      {/* Gauges */}
      <div className="flex justify-around items-center px-4 pb-4 shrink-0">
        <Gauge
          label="Risk Sentiment"
          score={regime.risk_score}
          color={getRiskColor(regime.risk_sentiment)}
          sublabel={getRiskLabel(regime.risk_sentiment)}
        />
        <Gauge
          label="Inflation"
          score={regime.inflation_score}
          color={getInflationColor(regime.inflation_regime)}
          sublabel={getInflationLabel(regime.inflation_regime)}
        />
        <Gauge
          label="USD Cycle"
          score={regime.usd_score}
          color={getUSDColor(regime.usd_cycle)}
          sublabel={getUSDLabel(regime.usd_cycle)}
        />
      </div>

      {/* Key Drivers */}
      <div className="flex-1 border-t border-[#1f1f1f] px-4 py-3 overflow-auto">
        <div className="font-mono text-[9px] text-[#888888] tracking-widest uppercase mb-2">Key Drivers</div>
        <ul className="space-y-1.5">
          {regime.key_drivers.map((driver, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-[#ff6600] mt-0.5 shrink-0 font-mono text-[9px]">›</span>
              <span className="font-mono text-[10px] text-[#888888] leading-snug">{driver}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
