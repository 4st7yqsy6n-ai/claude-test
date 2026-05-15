import { useEconomicCalendar } from '@/hooks/useMacroData';
import type { EconomicEvent, ImpactLevel } from '@/types';
import { format, isAfter, isBefore, addHours } from 'date-fns';
import clsx from 'clsx';

const IMPACT_CONFIG: Record<ImpactLevel, { emoji: string; label: string; color: string }> = {
  high:   { emoji: '🔴', label: 'HIGH',   color: 'text-[#ff3b3b]' },
  medium: { emoji: '🟡', label: 'MEDIUM', color: 'text-[#fbbf24]' },
  low:    { emoji: '⚪', label: 'LOW',    color: 'text-[#555555]' },
};

const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸',
  EU: '🇪🇺',
  GB: '🇬🇧',
  JP: '🇯🇵',
  CN: '🇨🇳',
  CA: '🇨🇦',
  AU: '🇦🇺',
  CH: '🇨🇭',
  DE: '🇩🇪',
  FR: '🇫🇷',
};

function EventRow({ event }: { event: EconomicEvent }) {
  const now = new Date();
  const eventTime = new Date(event.datetime);
  const isUpcoming = isAfter(eventTime, now) && isBefore(eventTime, addHours(now, 24));
  const isPast = isBefore(eventTime, now);
  const impact = IMPACT_CONFIG[event.impact];
  const flag = COUNTRY_FLAGS[event.country_code] ?? '🌐';

  const actualColor = (() => {
    if (!event.actual || !event.forecast) return 'text-[#e8e8e8]';
    const a = parseFloat(event.actual.replace('%', '').replace('K', '').replace('B', ''));
    const f = parseFloat(event.forecast.replace('%', '').replace('K', '').replace('B', ''));
    if (isNaN(a) || isNaN(f)) return 'text-[#e8e8e8]';
    return a > f ? 'text-[#00d37f]' : a < f ? 'text-[#ff3b3b]' : 'text-[#e8e8e8]';
  })();

  return (
    <tr className={clsx(
      'border-b border-[#1a1a1a] transition-colors',
      isUpcoming && 'bg-[#ff6600]/5 border-l-2 border-l-[#ff6600]',
      isPast && 'opacity-60',
      !isPast && !isUpcoming && 'hover:bg-[#141414]',
    )}>
      {/* Date/Time */}
      <td className="py-2.5 px-3 whitespace-nowrap">
        <div className="font-mono text-[10px] text-[#e8e8e8]">
          {format(eventTime, 'MMM dd')}
        </div>
        <div className="font-mono text-[9px] text-[#888888]">
          {format(eventTime, 'HH:mm')} ET
        </div>
      </td>

      {/* Country */}
      <td className="py-2.5 px-2 text-center">
        <span className="text-base leading-none">{flag}</span>
        <div className="font-mono text-[8px] text-[#555555]">{event.country_code}</div>
      </td>

      {/* Event Name */}
      <td className="py-2.5 px-2">
        <div className={clsx(
          'font-sans text-xs',
          isUpcoming ? 'text-[#e8e8e8] font-medium' : 'text-[#bbbbbb]'
        )}>
          {event.event}
        </div>
        {event.currency && (
          <div className="font-mono text-[9px] text-[#555555]">{event.currency}</div>
        )}
      </td>

      {/* Actual */}
      <td className={clsx('py-2.5 px-2 text-right font-mono text-[11px] tabular-nums font-bold', actualColor)}>
        {event.actual ?? <span className="text-[#333333]">—</span>}
      </td>

      {/* Forecast */}
      <td className="py-2.5 px-2 text-right font-mono text-[10px] text-[#888888] tabular-nums">
        {event.forecast ?? '—'}
      </td>

      {/* Previous */}
      <td className="py-2.5 px-2 text-right font-mono text-[10px] text-[#555555] tabular-nums">
        {event.previous ?? '—'}
      </td>

      {/* Impact */}
      <td className="py-2.5 px-3 text-center">
        <span title={impact.label} className="text-sm leading-none">{impact.emoji}</span>
      </td>
    </tr>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-[#1a1a1a] animate-pulse">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="py-2.5 px-2">
          <div className="h-3 bg-[#1f1f1f] rounded" />
        </td>
      ))}
    </tr>
  );
}

export default function EconomicCalendar() {
  const { data: events, isLoading } = useEconomicCalendar();

  const sortedEvents = [...(events ?? [])].sort(
    (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
  );

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1f1f1f] shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[#ff6600] font-mono text-[10px] font-bold tracking-widest">ECONOMIC CALENDAR</span>
          <div className="flex items-center gap-3 text-[9px] font-mono text-[#555555]">
            <span>🔴 High Impact</span>
            <span>🟡 Medium</span>
            <span>⚪ Low</span>
            <span className="text-[#ff6600]/70">▐ Upcoming 24h</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-[#0d0d0d] z-10 border-b border-[#1f1f1f]">
            <tr>
              {['DATE/TIME', 'CTY', 'EVENT', 'ACTUAL', 'FORECAST', 'PREVIOUS', 'IMPACT'].map((h) => (
                <th key={h} className="py-2 px-2 text-left font-mono text-[9px] text-[#555555] tracking-widest whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              : sortedEvents.map((event) => <EventRow key={event.id} event={event} />)
            }
          </tbody>
        </table>

        {!isLoading && sortedEvents.length === 0 && (
          <div className="flex items-center justify-center h-32 text-[#444444] font-mono text-sm">
            No events available
          </div>
        )}
      </div>
    </div>
  );
}
