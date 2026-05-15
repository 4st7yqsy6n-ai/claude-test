import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Area,
  ComposedChart,
  Legend,
} from 'recharts';
import { useYieldCurve } from '@/hooks/useMacroData';
import { format } from 'date-fns';

interface TooltipPayload {
  color: string;
  name: string;
  value: number;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded p-3">
      <p className="text-[#ff6600] font-mono text-[10px] font-bold mb-2">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-mono text-[10px]" style={{ color: p.color }}>
          {p.name}: {p.value?.toFixed(3)}%
        </p>
      ))}
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="w-full h-48 bg-[#111111] rounded animate-pulse mx-4" />
    </div>
  );
}

export default function YieldCurveChart() {
  const { data: yieldData, isLoading } = useYieldCurve();

  if (isLoading || !yieldData) {
    return (
      <div className="p-4 h-full">
        <div className="h-3 bg-[#1f1f1f] rounded w-32 mb-4 animate-pulse" />
        <SkeletonChart />
      </div>
    );
  }

  const chartData = yieldData.current.map((point) => ({
    maturity: point.maturity,
    current: point.yield,
    historical: point.yield_1y_ago,
    // For area fill between curves
    fill_up: point.yield > (point.yield_1y_ago ?? 0) ? point.yield : point.yield_1y_ago,
    fill_down: point.yield < (point.yield_1y_ago ?? 0) ? point.yield : point.yield_1y_ago,
  }));

  const inverted = yieldData.inverted;
  const spread = yieldData.spread_2s10s;

  return (
    <div className="p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[#ff6600] font-mono text-[10px] font-bold tracking-widest">US TREASURY YIELD CURVE</span>
          {inverted && (
            <span className="bg-[#ff3b3b]/20 border border-[#ff3b3b]/40 text-[#ff3b3b] font-mono text-[9px] px-2 py-0.5 rounded font-bold">
              INVERTED
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-[#ff6600] rounded" />
            <span className="text-[#888888] font-mono text-[9px]">Current</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 border-t border-dashed border-[#444444]" />
            <span className="text-[#888888] font-mono text-[9px]">1Y Ago</span>
          </div>
          {spread !== undefined && (
            <div className="font-mono text-[10px]">
              <span className="text-[#888888]">2s10s: </span>
              <span className={spread < 0 ? 'text-[#ff3b3b]' : 'text-[#00d37f]'}>
                {spread > 0 ? '+' : ''}{spread?.toFixed(3)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#1f1f1f" vertical={false} />
            <XAxis
              dataKey="maturity"
              tick={{ fill: '#888888', fontFamily: 'JetBrains Mono', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#1f1f1f' }}
            />
            <YAxis
              tick={{ fill: '#888888', fontFamily: 'JetBrains Mono', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v.toFixed(1)}%`}
              domain={['auto', 'auto']}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Inversion zone */}
            {inverted && (
              <ReferenceLine
                y={0}
                stroke="#ff3b3b"
                strokeDasharray="4 4"
                strokeOpacity={0.3}
              />
            )}

            {/* Historical (1Y ago) */}
            <Line
              type="monotone"
              dataKey="historical"
              stroke="#444444"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              name="1Y Ago"
              isAnimationActive={false}
            />

            {/* Current yield curve */}
            <Area
              type="monotone"
              dataKey="current"
              stroke="#ff6600"
              strokeWidth={2.5}
              fill="url(#yieldGradient)"
              dot={{ fill: '#ff6600', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#ff6600' }}
              name="Current"
              isAnimationActive={false}
            />

            <defs>
              <linearGradient id="yieldGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff6600" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#ff6600" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <Legend
              wrapperStyle={{ display: 'none' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-[#444444] font-mono text-[9px] shrink-0">
        As of {yieldData.as_of ? format(new Date(yieldData.as_of), 'MMM dd, yyyy') : 'Today'} • Source: US Treasury
      </div>
    </div>
  );
}
