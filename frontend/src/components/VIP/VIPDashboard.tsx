import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Crown } from 'lucide-react';
import {
  fetchVIPRegime,
  fetchVIPSignals,
  fetchVIPCalendar,
} from '@/lib/api';

import RegimeGauge from './RegimeGauge';
import SignalTable from './SignalTable';
import MacroCalendarVIP from './MacroCalendarVIP';
import StrategyLab from './StrategyLab';
import RiskAnalytics from './RiskAnalytics';
import ScenarioAnalysis from './ScenarioAnalysis';

type Tab = 'overview' | 'signals' | 'calendar' | 'strategy' | 'risk' | 'scenarios';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'OVERVIEW' },
  { key: 'signals', label: 'SIGNALS' },
  { key: 'calendar', label: 'MACRO CALENDAR' },
  { key: 'strategy', label: 'STRATEGY LAB' },
  { key: 'risk', label: 'RISK ANALYTICS' },
  { key: 'scenarios', label: 'SCENARIOS' },
];

function Skeleton() {
  return (
    <div className="h-full bg-[#0a0a0a] animate-pulse">
      <div className="h-full bg-[#1a1a1a] rounded m-4" />
    </div>
  );
}

export default function VIPDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { data: regime, isLoading: regimeLoading } = useQuery({
    queryKey: ['vip-regime'],
    queryFn: fetchVIPRegime,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: signals, isLoading: signalsLoading } = useQuery({
    queryKey: ['vip-signals'],
    queryFn: fetchVIPSignals,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: calendarEvents, isLoading: calendarLoading } = useQuery({
    queryKey: ['vip-calendar'],
    queryFn: fetchVIPCalendar,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1f1f1f] bg-[#0d0d0d] shrink-0">
        <div className="flex items-center gap-3">
          <Crown size={18} className="text-[#FFD700]" />
          <div>
            <div className="font-mono text-sm font-bold text-[#e8e8e8] tracking-widest uppercase">VIP Quant Edge</div>
            <div className="font-mono text-[9px] text-[#888888] tracking-widest uppercase">Gold & Forex Institutional Toolkit</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {regime && (
            <div
              className="font-mono text-[9px] px-2.5 py-1 rounded border"
              style={{
                color: regime.gold_bias === 'bullish' ? '#00d37f' : regime.gold_bias === 'bearish' ? '#ff3b3b' : '#ff6600',
                borderColor: regime.gold_bias === 'bullish' ? '#00d37f44' : regime.gold_bias === 'bearish' ? '#ff3b3b44' : '#ff660044',
                backgroundColor: regime.gold_bias === 'bullish' ? '#00d37f11' : regime.gold_bias === 'bearish' ? '#ff3b3b11' : '#ff660011',
              }}
            >
              GOLD {regime.gold_bias.toUpperCase()}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00d37f] animate-pulse" />
            <span className="font-mono text-[9px] text-[#00d37f] tracking-widest">LIVE</span>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-[#1f1f1f] bg-[#0d0d0d] shrink-0 overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`shrink-0 px-5 py-2.5 font-mono text-[10px] tracking-widest border-b-2 transition-all ${
              activeTab === key
                ? 'text-[#ff6600] border-[#ff6600] bg-[#ff6600]/5'
                : 'text-[#888888] border-transparent hover:text-[#e8e8e8] hover:bg-[#1a1a1a]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview' && (
          <div className="flex h-full gap-0 overflow-hidden">
            {/* Left: Regime Gauge */}
            <div className="w-[400px] shrink-0 border-r border-[#1f1f1f] overflow-hidden">
              {regimeLoading || !regime ? <Skeleton /> : <RegimeGauge regime={regime} />}
            </div>

            {/* Right: Top signals */}
            <div className="flex-1 overflow-hidden">
              {signalsLoading || !signals ? (
                <Skeleton />
              ) : (
                <SignalTable signals={signals.slice(0, 3)} />
              )}
            </div>
          </div>
        )}

        {activeTab === 'signals' && (
          <div className="h-full overflow-hidden">
            {signalsLoading || !signals ? (
              <Skeleton />
            ) : (
              <SignalTable signals={signals} />
            )}
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="h-full overflow-hidden">
            {calendarLoading ? (
              <Skeleton />
            ) : (
              <MacroCalendarVIP events={calendarEvents ?? []} />
            )}
          </div>
        )}

        {activeTab === 'strategy' && (
          <div className="h-full overflow-hidden">
            <StrategyLab />
          </div>
        )}

        {activeTab === 'risk' && (
          <div className="h-full overflow-hidden">
            <RiskAnalytics />
          </div>
        )}

        {activeTab === 'scenarios' && (
          <div className="h-full overflow-hidden">
            <ScenarioAnalysis />
          </div>
        )}
      </div>
    </div>
  );
}
