import { ResponsiveContainer, LineChart, Line, Tooltip } from 'recharts';

interface MiniChartProps {
  data: number[];
  positive?: boolean;
  height?: number;
}

export default function MiniChart({ data, positive = true, height = 36 }: MiniChartProps) {
  const chartData = data.map((value, index) => ({ index, value }));

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={positive ? '#00d37f' : '#ff3b3b'}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <Tooltip
            contentStyle={{ display: 'none' }}
            cursor={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
