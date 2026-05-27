import { useState } from 'react';
import type { VIPCalendarEvent } from '@/lib/api';

interface Props {
  events: VIPCalendarEvent[];
}

// Fallback mock VIP calendar data
const MOCK_CALENDAR_EVENTS: VIPCalendarEvent[] = [
  {
    id: 'c1',
    datetime: new Date(Date.now() + 2 * 3600_000).toISOString(),
    event: 'US CPI MoM',
    country: 'United States',
    country_code: 'US',
    currency: 'USD',
    impact: 'high',
    forecast: '0.3%',
    previous: '0.2%',
    actual: null,
    surprise_index: null,
    historical_gold_reaction: '+0.8% avg on hot print, -0.4% on cool print',
    historical_fx_reaction: { 'EUR/USD': '-0.3% on hot', 'USD/JPY': '+0.4% on hot', 'XAU/USD': '+0.8% on hot' },
    gold_impact_score: 9.2,
    pairs_affected: ['XAU/USD', 'EUR/USD', 'USD/JPY', 'GBP/USD']
  },
  {
    id: 'c2',
    datetime: new Date(Date.now() + 5 * 3600_000).toISOString(),
    event: 'Fed Chair Powell Speech',
    country: 'United States',
    country_code: 'US',
    currency: 'USD',
    impact: 'high',
    forecast: '',
    previous: '',
    actual: null,
    surprise_index: null,
    historical_gold_reaction: '±1.2% volatility spike typical on rate path commentary',
    historical_fx_reaction: { 'EUR/USD': '±0.5% on hawkish/dovish tone', 'USD/JPY': '±0.6%', 'XAU/USD': '±1.2%' },
    gold_impact_score: 8.8,
    pairs_affected: ['XAU/USD', 'EUR/USD', 'USD/JPY', 'GBP/USD', 'AUD/USD']
  },
  {
    id: 'c3',
    datetime: new Date(Date.now() + 26 * 3600_000).toISOString(),
    event: 'Non-Farm Payrolls',
    country: 'United States',
    country_code: 'US',
    currency: 'USD',
    impact: 'high',
    forecast: '185K',
    previous: '256K',
    actual: null,
    surprise_index: null,
    historical_gold_reaction: '-0.6% avg on strong NFP, +0.4% on miss',
    historical_fx_reaction: { 'EUR/USD': '-0.4% on strong', 'USD/JPY': '+0.5% on strong', 'XAU/USD': '-0.6% on strong' },
    gold_impact_score: 8.1,
    pairs_affected: ['XAU/USD', 'EUR/USD', 'USD/JPY', 'AUD/USD']
  },
  {
    id: 'c4',
    datetime: new Date(Date.now() + 27 * 3600_000).toISOString(),
    event: 'Unemployment Rate',
    country: 'United States',
    country_code: 'US',
    currency: 'USD',
    impact: 'high',
    forecast: '3.9%',
    previous: '3.9%',
    actual: null,
    surprise_index: null,
    historical_gold_reaction: 'Secondary to NFP, moderate gold impact',
    historical_fx_reaction: { 'EUR/USD': '±0.1%', 'USD/JPY': '±0.15%', 'XAU/USD': '±0.2%' },
    gold_impact_score: 5.5,
    pairs_affected: ['XAU/USD', 'EUR/USD', 'USD/JPY']
  },
  {
    id: 'c5',
    datetime: new Date(Date.now() + 50 * 3600_000).toISOString(),
    event: 'ECB Interest Rate Decision',
    country: 'European Union',
    country_code: 'EU',
    currency: 'EUR',
    impact: 'high',
    forecast: '3.90%',
    previous: '4.25%',
    actual: null,
    surprise_index: null,
    historical_gold_reaction: 'EUR weakness → gold usually bid on ECB cuts (USD strength offset by risk-on)',
    historical_fx_reaction: { 'EUR/USD': '-0.4% on cut', 'GBP/USD': '-0.1% sympathy', 'XAU/EUR': '+0.5% on cut' },
    gold_impact_score: 6.4,
    pairs_affected: ['EUR/USD', 'XAU/EUR', 'GBP/USD', 'EUR/JPY']
  },
  {
    id: 'c6',
    datetime: new Date(Date.now() - 4 * 3600_000).toISOString(),
    event: 'ISM Manufacturing PMI',
    country: 'United States',
    country_code: 'US',
    currency: 'USD',
    impact: 'medium',
    forecast: '49.8',
    previous: '47.2',
    actual: '49.1',
    surprise_index: -0.7,
    historical_gold_reaction: 'Weak PMI → risk-off → gold +0.2% avg',
    historical_fx_reaction: { 'EUR/USD': '+0.1%', 'USD/JPY': '-0.2%', 'XAU/USD': '+0.2%' },
    gold_impact_score: 4.2,
    pairs_affected: ['XAU/USD', 'USD/JPY', 'AUD/USD']
  },
  {
    id: 'c7',
    datetime: new Date(Date.now() - 7 * 3600_000).toISOString(),
    event: 'Initial Jobless Claims',
    country: 'United States',
    country_code: 'US',
    currency: 'USD',
    impact: 'medium',
    forecast: '225K',
    previous: '231K',
    actual: '218K',
    surprise_index: 7,
    historical_gold_reaction: 'Low claims → labor strength → gold muted to slight negative',
    historical_fx_reaction: { 'EUR/USD': '-0.1%', 'USD/JPY': '+0.15%', 'XAU/USD': '-0.1%' },
    gold_impact_score: 3.1,
    pairs_affected: ['XAU/USD', 'EUR/USD', 'USD/JPY']
  },
];

function ImpactDots({ impact }: { impact: 'high' | 'medium' | 'low' }) {
  return (
    <div className="flex items-center gap-0.5">
      <span className={impact === 'high' ? 'text-[#ff3b3b]' : 'text-[#333333]'}>●</span>
      <span className={impact !== 'low' ? 'text-[#f59e0b]' : 'text-[#333333]'}>●</span>
      <span className={impact === 'low' ? 'text-[#888888]' : 'text-[#333333]'}>●</span>
    </div>
  );
}

function GoldImpactBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1.5 min-w-[80px]">
      <div className="flex-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${(score / 10) * 100}%`, backgroundColor: '#ff6600' }}
        />
      </div>
      <span className="font-mono text-[9px] text-[#ff6600] tabular-nums w-6 text-right">{score.toFixed(1)}</span>
    </div>
  );
}

function CountryFlag({ code }: { code: string }) {
  const flags: Record<string, string> = {
    US: '🇺🇸', EU: '🇪🇺', GB: '🇬🇧', JP: '🇯🇵', CA: '🇨🇦', AU: '🇦🇺', CH: '🇨🇭', NZ: '🇳🇿', CN: '🇨🇳',
  };
  return <span className="text-sm">{flags[code] ?? '🌐'}</span>;
}

function SurpriseIndex({ value }: { value: number }) {
  const color = value > 0 ? '#00d37f' : '#ff3b3b';
  const sign = value > 0 ? '+' : '';
  return (
    <span className="font-mono text-[9px] font-bold tabular-nums" style={{ color }}>
      {sign}{value.toFixed(1)}
    </span>
  );
}

function EventRow({ event: ev, expanded, onToggle }: {
  event: VIPCalendarEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const dt = new Date(ev.datetime);
  const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const isReleased = ev.actual !== null;

  return (
    <div className="border-b border-[#111111]">
      <button
        onClick={onToggle}
        className="w-full text-left grid grid-cols-[48px_24px_50px_1fr_64px_80px_80px] gap-2 px-3 py-2.5 hover:bg-[#111111] transition-colors items-center"
      >
        {/* Time */}
        <span className="font-mono text-[9px] text-[#888888] tabular-nums">{timeStr}</span>
        {/* Flag */}
        <CountryFlag code={ev.country_code} />
        {/* Currency */}
        <span className="font-mono text-[9px] text-[#888888]">{ev.currency}</span>
        {/* Event name + impact */}
        <div className="flex items-center gap-2 min-w-0">
          <ImpactDots impact={ev.impact} />
          <span className="font-mono text-[10px] text-[#e8e8e8] truncate">{ev.event}</span>
        </div>
        {/* Forecast / Actual */}
        <div className="flex flex-col items-end">
          {isReleased ? (
            <>
              <span className="font-mono text-[9px] text-[#e8e8e8] tabular-nums">{ev.actual}</span>
              {ev.surprise_index !== null && <SurpriseIndex value={ev.surprise_index} />}
            </>
          ) : (
            <>
              <span className="font-mono text-[9px] text-[#888888] tabular-nums">{ev.forecast || 'N/A'}</span>
              <span className="font-mono text-[8px] text-[#444444]">fcst</span>
            </>
          )}
        </div>
        {/* Gold Impact */}
        <GoldImpactBar score={ev.gold_impact_score} />
        {/* Pairs */}
        <div className="flex flex-wrap gap-0.5 justify-end">
          {ev.pairs_affected.slice(0, 2).map((p) => (
            <span key={p} className="font-mono text-[7px] bg-[#1a1a1a] text-[#888888] px-1 rounded">{p}</span>
          ))}
          {ev.pairs_affected.length > 2 && (
            <span className="font-mono text-[7px] text-[#444444]">+{ev.pairs_affected.length - 2}</span>
          )}
        </div>
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="px-4 pb-3 bg-[#0a0a0a] border-t border-[#1a1a1a]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
            <div>
              <div className="font-mono text-[9px] text-[#ff6600] tracking-widest uppercase mb-1.5">Gold Historical Reaction</div>
              <p className="font-mono text-[10px] text-[#888888] leading-relaxed">{ev.historical_gold_reaction}</p>
              <div className="mt-2">
                <div className="font-mono text-[9px] text-[#444444] tracking-widest uppercase mb-1">Forecast vs Previous</div>
                <div className="flex items-center gap-3">
                  {ev.forecast && <span className="font-mono text-[10px] text-[#e8e8e8]">Fcst: <span className="text-[#ff6600]">{ev.forecast}</span></span>}
                  {ev.previous && <span className="font-mono text-[10px] text-[#888888]">Prev: {ev.previous}</span>}
                  {ev.actual && <span className="font-mono text-[10px] font-bold text-[#00d37f]">Act: {ev.actual}</span>}
                </div>
              </div>
            </div>
            <div>
              <div className="font-mono text-[9px] text-[#888888] tracking-widest uppercase mb-1.5">Typical FX Reactions</div>
              <div className="space-y-1">
                {Object.entries(ev.historical_fx_reaction).map(([pair, reaction]) => (
                  <div key={pair} className="flex items-center gap-2">
                    <span className="font-mono text-[9px] text-[#ff6600] w-16 shrink-0">{pair}</span>
                    <span className="font-mono text-[9px] text-[#888888]">{reaction}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MacroCalendarVIP({ events }: Props) {
  const [filter, setFilter] = useState<'ALL' | 'HIGH' | 'GOLD-IMPACT'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const data = events.length > 0 ? events : MOCK_CALENDAR_EVENTS;

  const upcoming = data.filter((e) => e.actual === null);
  const released = data.filter((e) => e.actual !== null);

  function applyFilter(list: VIPCalendarEvent[]) {
    if (filter === 'HIGH') return list.filter((e) => e.impact === 'high');
    if (filter === 'GOLD-IMPACT') return list.filter((e) => e.gold_impact_score >= 6);
    return list;
  }

  const filteredUpcoming = applyFilter(upcoming);
  const filteredReleased = applyFilter(released);

  function groupByDay(list: VIPCalendarEvent[]) {
    const groups: Record<string, VIPCalendarEvent[]> = {};
    list.forEach((e) => {
      const day = new Date(e.datetime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      if (!groups[day]) groups[day] = [];
      groups[day].push(e);
    });
    return groups;
  }

  const upcomingGroups = groupByDay(filteredUpcoming);
  const releasedGroups = groupByDay(filteredReleased);

  return (
    <div className="flex flex-col bg-[#0d0d0d] border border-[#1f1f1f] rounded-sm overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1f1f1f] shrink-0">
        <span className="font-mono text-[10px] tracking-widest text-[#888888] uppercase">VIP Macro Calendar</span>
        <div className="flex items-center gap-1">
          {(['ALL', 'HIGH', 'GOLD-IMPACT'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`font-mono text-[8px] px-2 py-0.5 rounded tracking-wider transition-colors ${
                filter === f
                  ? 'bg-[#ff6600] text-black'
                  : 'bg-[#1a1a1a] text-[#888888] hover:text-[#e8e8e8]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[48px_24px_50px_1fr_64px_80px_80px] gap-2 px-3 py-1.5 border-b border-[#1f1f1f] shrink-0">
        {['TIME', '', 'CCY', 'EVENT', 'ACT/FCST', 'GOLD IMP', 'PAIRS'].map((h, i) => (
          <span key={i} className="font-mono text-[8px] text-[#444444] tracking-widest uppercase">{h}</span>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Upcoming */}
        {filteredUpcoming.length > 0 && (
          <>
            <div className="px-3 py-1.5 bg-[#0a0a0a] border-b border-[#1f1f1f]">
              <span className="font-mono text-[9px] text-[#ff6600] tracking-widest uppercase">Upcoming</span>
            </div>
            {Object.entries(upcomingGroups).map(([day, evs]) => (
              <div key={day}>
                <div className="px-3 py-1 bg-[#111111] border-b border-[#1a1a1a]">
                  <span className="font-mono text-[8px] text-[#888888] tracking-widest">{day}</span>
                </div>
                {evs.map((ev) => (
                  <EventRow
                    key={ev.id}
                    event={ev}
                    expanded={expandedId === ev.id}
                    onToggle={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                  />
                ))}
              </div>
            ))}
          </>
        )}

        {/* Released */}
        {filteredReleased.length > 0 && (
          <>
            <div className="px-3 py-1.5 bg-[#0a0a0a] border-b border-[#1f1f1f]">
              <span className="font-mono text-[9px] text-[#888888] tracking-widest uppercase">Released</span>
            </div>
            {Object.entries(releasedGroups).map(([day, evs]) => (
              <div key={day}>
                <div className="px-3 py-1 bg-[#111111] border-b border-[#1a1a1a]">
                  <span className="font-mono text-[8px] text-[#888888] tracking-widest">{day}</span>
                </div>
                {evs.map((ev) => (
                  <EventRow
                    key={ev.id}
                    event={ev}
                    expanded={expandedId === ev.id}
                    onToggle={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                  />
                ))}
              </div>
            ))}
          </>
        )}

        {filteredUpcoming.length === 0 && filteredReleased.length === 0 && (
          <div className="flex items-center justify-center h-24">
            <span className="font-mono text-[10px] text-[#444444]">No events matching filter</span>
          </div>
        )}
      </div>
    </div>
  );
}
