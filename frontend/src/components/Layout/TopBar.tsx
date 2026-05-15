import { useState, useEffect, useCallback } from 'react';
import { Settings, Wifi, WifiOff, ChevronRight } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useMarketStore } from '@/stores/marketStore';
import { format } from 'date-fns';
import clsx from 'clsx';

function isNYSEOpen(): boolean {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;

  // Eastern time offset (rough: UTC-5 standard, UTC-4 daylight)
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  const etOffset = -4; // daylight saving approximation
  const etHour = ((utcHour + etOffset) % 24 + 24) % 24;
  const etMinutes = etHour * 60 + utcMin;

  return etMinutes >= 9 * 60 + 30 && etMinutes < 16 * 60;
}

interface TopBarProps {
  wsConnected?: boolean;
}

export default function TopBar({ wsConnected = false }: TopBarProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { openCommandPalette } = useUIStore();
  const { selectedSymbol } = useMarketStore();
  const nyseOpen = isNYSEOpen();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCommandBarClick = useCallback(() => {
    openCommandPalette();
  }, [openCommandPalette]);

  return (
    <div className="h-12 bg-[#0d0d0d] border-b border-[#1f1f1f] flex items-center justify-between px-4 shrink-0 z-50">
      {/* LEFT: Logo */}
      <div className="flex items-center gap-3 w-52">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#ff6600] rounded flex items-center justify-center">
            <span className="text-black text-xs font-black font-mono">Q∞</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[#ff6600] font-black font-mono text-sm tracking-widest">QUANT∞</span>
            <span className="text-[#888888] font-mono text-[9px] tracking-[0.25em] uppercase">Terminal</span>
          </div>
        </div>

        {/* Market Status */}
        <div className={clsx(
          'ml-2 px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-widest border',
          nyseOpen
            ? 'text-[#00d37f] border-[#00d37f]/30 bg-[#00d37f]/10'
            : 'text-[#888888] border-[#888888]/30 bg-[#888888]/10'
        )}>
          NYSE {nyseOpen ? 'OPEN' : 'CLOSED'}
        </div>
      </div>

      {/* CENTER: Command Bar */}
      <button
        onClick={handleCommandBarClick}
        className="flex-1 max-w-xl mx-4 h-8 bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 flex items-center gap-2 hover:border-[#ff6600]/60 hover:bg-[#1f1f1f] transition-all group cursor-text"
      >
        <span className="text-[#ff6600] font-mono text-xs font-bold">›</span>
        <span className="text-[#888888] font-mono text-xs flex items-center gap-1">
          EQ{' '}
          <span className="text-[#ff6600]">{selectedSymbol}</span>
          <ChevronRight size={10} className="text-[#888888]" />
          <span className="text-[#888888]">GO</span>
        </span>
        <span className="ml-auto text-[#444444] font-mono text-[10px] group-hover:text-[#ff6600]/60 transition-colors">
          Ctrl+K
        </span>
      </button>

      {/* RIGHT: Clock + Status */}
      <div className="flex items-center gap-4 w-64 justify-end">
        {/* Connection Status */}
        <div className="flex items-center gap-1.5">
          {wsConnected ? (
            <>
              <Wifi size={12} className="text-[#00d37f]" />
              <span className="text-[#00d37f] font-mono text-[10px]">LIVE</span>
            </>
          ) : (
            <>
              <WifiOff size={12} className="text-[#888888]" />
              <span className="text-[#888888] font-mono text-[10px]">SIM</span>
            </>
          )}
          <div className={clsx(
            'w-1.5 h-1.5 rounded-full',
            wsConnected ? 'bg-[#00d37f] animate-pulse' : 'bg-[#ff6600] animate-pulse'
          )} />
        </div>

        {/* Clock */}
        <div className="flex flex-col items-end leading-none gap-0.5">
          <span className="text-[#e8e8e8] font-mono text-xs tabular-nums">
            {format(currentTime, 'HH:mm:ss')}
          </span>
          <span className="text-[#888888] font-mono text-[9px] tabular-nums">
            {format(currentTime, 'EEE dd MMM yyyy')}
          </span>
        </div>

        {/* Settings */}
        <button className="text-[#888888] hover:text-[#ff6600] transition-colors p-1 rounded hover:bg-[#ff6600]/10">
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
}
