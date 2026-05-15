import { useState, useEffect, useRef, useCallback } from 'react';
import { useUIStore, type ActiveView } from '@/stores/uiStore';
import { useMarketStore } from '@/stores/marketStore';
import { Monitor, Globe, Filter, Newspaper, Brain, BarChart2, X } from 'lucide-react';
import clsx from 'clsx';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  category: 'navigation' | 'market' | 'symbol' | 'command';
  icon?: React.ElementType;
  shortcut?: string;
  action: () => void;
}

const NAVIGATION_COMMANDS = (setView: (v: ActiveView) => void, close: () => void): CommandItem[] => [
  { id: 'nav-terminal', label: 'Terminal', description: 'Trading terminal with charts', category: 'navigation', icon: Monitor, shortcut: 'F1', action: () => { setView('terminal'); close(); } },
  { id: 'nav-macro', label: 'Macro Dashboard', description: 'Yield curve, macro indicators, world monitor', category: 'navigation', icon: Globe, shortcut: 'F2', action: () => { setView('macro'); close(); } },
  { id: 'nav-screener', label: 'Screener', description: 'Top movers and sector heatmap', category: 'navigation', icon: Filter, shortcut: 'F3', action: () => { setView('screener'); close(); } },
  { id: 'nav-news', label: 'News Feed', description: 'Market news and headlines', category: 'navigation', icon: Newspaper, shortcut: 'F4', action: () => { setView('news'); close(); } },
  { id: 'nav-ai', label: 'AI Analyst', description: 'AI-powered market analysis', category: 'navigation', icon: Brain, shortcut: 'F5', action: () => { setView('ai'); close(); } },
  { id: 'nav-backtest', label: 'Backtesting', description: 'Strategy backtesting engine', category: 'navigation', icon: BarChart2, shortcut: 'F6', action: () => { setView('backtesting'); close(); } },
];

const QUICK_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'META', 'AMZN', 'GOOGL', 'TSLA', 'SPY', 'QQQ', 'GLD', 'BTCUSD', 'EURUSD'];

export default function CommandPalette() {
  const { commandPaletteOpen, closeCommandPalette, setActiveView } = useUIStore();
  const { setSelectedSymbol, watchlist, liveprices } = useMarketStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    closeCommandPalette();
    setQuery('');
    setSelectedIndex(0);
  }, [closeCommandPalette]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [commandPaletteOpen]);

  // Build commands
  const navCommands = NAVIGATION_COMMANDS(setActiveView, close);

  const symbolCommands: CommandItem[] = QUICK_SYMBOLS.map((sym) => ({
    id: `sym-${sym}`,
    label: `EQ ${sym}`,
    description: `View ${sym} chart and data`,
    category: 'symbol' as const,
    action: () => {
      setSelectedSymbol(sym);
      setActiveView('terminal');
      close();
    },
  }));

  const watchlistCommands: CommandItem[] = watchlist.map((sym) => {
    const data = liveprices[sym];
    return {
      id: `watch-${sym}`,
      label: sym,
      description: data ? `${data.price.toFixed(2)} ${data.change_pct >= 0 ? '▲' : '▼'} ${Math.abs(data.change_pct).toFixed(2)}%` : 'Watchlist',
      category: 'market' as const,
      action: () => {
        setSelectedSymbol(sym);
        setActiveView('terminal');
        close();
      },
    };
  });

  // Filter
  const q = query.toLowerCase().trim();
  const filteredNav = q ? navCommands.filter((c) => c.label.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)) : navCommands;
  const filteredSymbols = q ? symbolCommands.filter((c) => c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) : [];
  const filteredWatchlist = q ? watchlistCommands.filter((c) => c.label.toLowerCase().includes(q)) : watchlistCommands;

  const allItems: CommandItem[] = [
    ...filteredNav,
    ...filteredSymbols,
    ...filteredWatchlist,
  ];

  // Arrow key navigation
  useEffect(() => {
    if (!commandPaletteOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && allItems[selectedIndex]) {
        allItems[selectedIndex].action();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commandPaletteOpen, allItems, selectedIndex, close]);

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!commandPaletteOpen) return null;

  const renderSection = (items: CommandItem[], title: string, globalStartIdx: number) => {
    if (items.length === 0) return null;
    return (
      <div key={title}>
        <div className="px-4 py-1.5 text-[#444444] font-mono text-[9px] tracking-widest uppercase">
          {title}
        </div>
        {items.map((item, localIdx) => {
          const globalIdx = globalStartIdx + localIdx;
          const isSelected = globalIdx === selectedIndex;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.action}
              onMouseEnter={() => setSelectedIndex(globalIdx)}
              className={clsx(
                'w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors',
                isSelected ? 'bg-[#ff6600]/15 border-l-2 border-[#ff6600]' : 'border-l-2 border-transparent hover:bg-[#1a1a1a]'
              )}
            >
              {Icon && (
                <Icon size={14} className={isSelected ? 'text-[#ff6600]' : 'text-[#555555]'} />
              )}
              {!Icon && (
                <div className={clsx(
                  'w-3.5 h-3.5 rounded text-[8px] font-bold font-mono flex items-center justify-center',
                  isSelected ? 'bg-[#ff6600] text-black' : 'bg-[#2a2a2a] text-[#888888]'
                )}>
                  {item.label.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className={clsx(
                  'font-mono text-xs font-bold',
                  isSelected ? 'text-[#ff6600]' : 'text-[#e8e8e8]'
                )}>
                  {item.label}
                </div>
                {item.description && (
                  <div className="text-[#555555] font-mono text-[9px] truncate">{item.description}</div>
                )}
              </div>
              {item.shortcut && (
                <span className="text-[#333333] font-mono text-[9px] shrink-0">{item.shortcut}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  let idx = 0;
  const navSection = renderSection(filteredNav, 'NAVIGATION', idx);
  idx += filteredNav.length;
  const symbolSection = renderSection(filteredSymbols, 'SYMBOLS', idx);
  idx += filteredSymbols.length;
  const watchlistSection = renderSection(filteredWatchlist, q ? 'WATCHLIST' : 'RECENT SYMBOLS', idx);

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-start justify-center pt-[10vh]"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="w-full max-w-2xl bg-[#111111] border border-[#2a2a2a] rounded-lg shadow-2xl overflow-hidden animate-slide-in">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1f1f1f]">
          <span className="text-[#ff6600] font-mono text-base font-bold">›</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or symbol... (e.g., 'AAPL', 'macro', 'news')"
            className="flex-1 bg-transparent text-[#e8e8e8] font-mono text-sm focus:outline-none placeholder-[#333333]"
          />
          <button onClick={close} className="text-[#444444] hover:text-[#888888] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-auto">
          {allItems.length === 0 && (
            <div className="px-4 py-8 text-center text-[#444444] font-mono text-sm">
              No results for "{query}"
            </div>
          )}
          {navSection}
          {symbolSection}
          {watchlistSection}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[#1f1f1f] flex items-center gap-4 text-[#333333] font-mono text-[9px]">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>ESC Close</span>
          <span className="ml-auto text-[#ff6600]/50">QUANT∞ TERMINAL</span>
        </div>
      </div>
    </div>
  );
}
