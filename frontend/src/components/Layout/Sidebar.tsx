import { Monitor, Globe, Filter, Newspaper, Brain, BarChart2, Crown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useUIStore, type ActiveView } from '@/stores/uiStore';
import { useMarketStore } from '@/stores/marketStore';
import clsx from 'clsx';

const NAV_ITEMS: { view: ActiveView; icon: React.ElementType; label: string; shortcut: string }[] = [
  { view: 'terminal', icon: Monitor, label: 'Terminal', shortcut: 'F1' },
  { view: 'macro', icon: Globe, label: 'Macro', shortcut: 'F2' },
  { view: 'screener', icon: Filter, label: 'Screener', shortcut: 'F3' },
  { view: 'news', icon: Newspaper, label: 'News', shortcut: 'F4' },
  { view: 'ai', icon: Brain, label: 'AI Analyst', shortcut: 'F5' },
  { view: 'backtesting', icon: BarChart2, label: 'Backtest', shortcut: 'F6' },
  { view: 'vip', icon: Crown, label: 'VIP Edge', shortcut: 'F7' },
];

function formatChange(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

function formatPrice(price: number): string {
  if (price >= 10000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (price >= 100) return price.toFixed(2);
  return price.toFixed(4);
}

export default function Sidebar() {
  const { activeView, setActiveView, sidebarOpen, toggleSidebar } = useUIStore();
  const { watchlist, liveprices, priceFlash, setSelectedSymbol } = useMarketStore();

  const top5 = watchlist.slice(0, 6);

  return (
    <div
      className={clsx(
        'flex flex-col bg-[#0d0d0d] border-r border-[#1f1f1f] transition-all duration-300 shrink-0 relative',
        sidebarOpen ? 'w-48' : 'w-12'
      )}
    >
      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-16 w-6 h-6 bg-[#1f1f1f] border border-[#2a2a2a] rounded-full flex items-center justify-center text-[#888888] hover:text-[#ff6600] hover:border-[#ff6600]/50 transition-colors z-10"
      >
        {sidebarOpen ? <ChevronLeft size={10} /> : <ChevronRight size={10} />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 pt-2">
        {NAV_ITEMS.map(({ view, icon: Icon, label, shortcut }) => {
          const isActive = activeView === view;
          return (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              title={!sidebarOpen ? `${label} (${shortcut})` : undefined}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-2.5 relative transition-all group',
                isActive
                  ? 'text-[#ff6600] bg-[#ff6600]/10'
                  : 'text-[#888888] hover:text-[#e8e8e8] hover:bg-[#1a1a1a]'
              )}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#ff6600] rounded-r" />
              )}

              <Icon size={16} className={clsx('shrink-0', isActive ? 'text-[#ff6600]' : '')} />

              {sidebarOpen && (
                <>
                  <span className="font-mono text-xs flex-1 text-left">{label}</span>
                  <span className="text-[#444444] font-mono text-[9px] group-hover:text-[#888888] transition-colors">
                    {shortcut}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="border-t border-[#1f1f1f] mx-2 my-2" />

      {/* Watchlist */}
      <div className="pb-2">
        {sidebarOpen && (
          <div className="px-3 py-1.5">
            <span className="text-[#888888] font-mono text-[9px] tracking-widest uppercase">Watchlist</span>
          </div>
        )}
        {top5.map((symbol) => {
          const data = liveprices[symbol];
          const flash = priceFlash[symbol];
          if (!data) return null;

          return (
            <button
              key={symbol}
              onClick={() => setSelectedSymbol(symbol)}
              title={!sidebarOpen ? symbol : undefined}
              className={clsx(
                'w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#1a1a1a] transition-all group',
                flash === 'up' && 'bg-[#00d37f]/10',
                flash === 'down' && 'bg-[#ff3b3b]/10',
              )}
            >
              <span className={clsx(
                'font-mono text-[10px] font-bold shrink-0',
                sidebarOpen ? 'w-12' : 'w-full text-center',
                data.change_pct >= 0 ? 'text-[#e8e8e8]' : 'text-[#e8e8e8]'
              )}>
                {symbol}
              </span>

              {sidebarOpen && (
                <div className="flex flex-col items-end flex-1 min-w-0 leading-none gap-0.5">
                  <span className="text-[#e8e8e8] font-mono text-[10px] tabular-nums">
                    {formatPrice(data.price)}
                  </span>
                  <span className={clsx(
                    'font-mono text-[9px] tabular-nums',
                    data.change_pct >= 0 ? 'text-[#00d37f]' : 'text-[#ff3b3b]'
                  )}>
                    {formatChange(data.change_pct)}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
