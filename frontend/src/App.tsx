import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUIStore } from '@/stores/uiStore';
import { useWebSocket } from '@/hooks/useWebSocket';

// Layout
import TopBar from '@/components/Layout/TopBar';
import TickerTape from '@/components/Layout/TickerTape';
import Sidebar from '@/components/Layout/Sidebar';

// Dashboard
import MarketOverview from '@/components/Dashboard/MarketOverview';
import MacroDashboard from '@/components/Dashboard/MacroDashboard';
import WorldMonitor from '@/components/Dashboard/WorldMonitor';

// Charts
import TradingViewChart from '@/components/Charts/TradingViewChart';
import YieldCurveChart from '@/components/Charts/YieldCurveChart';
import CorrelationMatrix from '@/components/Charts/CorrelationMatrix';

// Panels
import NewsPanel from '@/components/Panels/NewsPanel';
import ScreenerPanel from '@/components/Panels/ScreenerPanel';
import EconomicCalendar from '@/components/Panels/EconomicCalendar';

// AI
import AIAnalyst from '@/components/AI/AIAnalyst';

// VIP
import VIPDashboard from '@/components/VIP/VIPDashboard';

// Command Palette
import CommandPalette from '@/components/CommandPalette/CommandPalette';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

// ─── Terminal View: Chart + Market Overview + Side Panel ─────────────────────

function TerminalView() {
  const { rightPanelMode, setRightPanelMode } = useUIStore();

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TradingView Chart - top 60% */}
        <div className="h-[58%] border-b border-[#1f1f1f] shrink-0">
          <TradingViewChart />
        </div>

        {/* Market Overview - bottom 40% */}
        <div className="flex-1 overflow-auto">
          <MarketOverview />
        </div>
      </div>

      {/* Right Panel - 340px */}
      <div className="w-[340px] shrink-0 border-l border-[#1f1f1f] flex flex-col overflow-hidden">
        {/* Panel selector tabs */}
        <div className="flex border-b border-[#1f1f1f] shrink-0">
          {[
            { key: 'news' as const, label: 'NEWS' },
            { key: 'ai' as const, label: 'AI ANALYST' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRightPanelMode(key)}
              className={`flex-1 py-2.5 font-mono text-[10px] tracking-wider border-b-2 transition-all ${
                rightPanelMode === key
                  ? 'text-[#ff6600] border-[#ff6600] bg-[#ff6600]/5'
                  : 'text-[#888888] border-transparent hover:text-[#e8e8e8] hover:bg-[#1a1a1a]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          {rightPanelMode === 'news' ? (
            <NewsPanel compact />
          ) : (
            <AIAnalyst />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Macro View ───────────────────────────────────────────────────────────────

function MacroView() {
  return (
    <div className="h-full overflow-auto">
      {/* Macro Indicators */}
      <MacroDashboard />

      {/* Yield Curve + Correlation side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-t border-[#1f1f1f]">
        <div className="border-r border-[#1f1f1f] h-[380px]">
          <YieldCurveChart />
        </div>
        <div className="h-[380px]">
          <CorrelationMatrix />
        </div>
      </div>

      {/* World Monitor */}
      <div className="border-t border-[#1f1f1f]">
        <WorldMonitor />
      </div>
    </div>
  );
}

// ─── Screener View ────────────────────────────────────────────────────────────

function ScreenerView() {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Screener */}
      <div className="flex-1 min-w-0 border-r border-[#1f1f1f] overflow-hidden">
        <ScreenerPanel />
      </div>
      {/* Right: Economic Calendar */}
      <div className="w-[480px] shrink-0 overflow-hidden">
        <EconomicCalendar />
      </div>
    </div>
  );
}

// ─── Backtesting View (placeholder) ──────────────────────────────────────────

function BacktestingView() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="text-[#ff6600] font-mono text-4xl mb-4">📊</div>
        <div className="text-[#e8e8e8] font-mono text-xl mb-2">BACKTESTING ENGINE</div>
        <div className="text-[#888888] font-mono text-sm mb-6">Strategy backtesting module coming soon</div>
        <div className="bg-[#111111] border border-[#1f1f1f] rounded p-6 max-w-md mx-auto">
          <div className="text-[#ff6600] font-mono text-[10px] mb-3 tracking-widest">PLANNED FEATURES</div>
          {[
            'Historical data backtesting',
            'Custom strategy builder',
            'Risk-adjusted metrics (Sharpe, Sortino, Calmar)',
            'Monte Carlo simulation',
            'Walk-forward optimization',
            'Position sizing algorithms',
          ].map((f) => (
            <div key={f} className="flex items-center gap-2 mb-1.5">
              <span className="text-[#ff6600]">›</span>
              <span className="text-[#888888] font-mono text-xs">{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Inner App (needs QueryClient context) ───────────────────────────────────

function AppContent() {
  const { activeView, openCommandPalette, toggleCommandPalette } = useUIStore();
  useWebSocket();

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
      }
      // F-key shortcuts
      if (e.key === 'F1') { e.preventDefault(); useUIStore.getState().setActiveView('terminal'); }
      if (e.key === 'F2') { e.preventDefault(); useUIStore.getState().setActiveView('macro'); }
      if (e.key === 'F3') { e.preventDefault(); useUIStore.getState().setActiveView('screener'); }
      if (e.key === 'F4') { e.preventDefault(); useUIStore.getState().setActiveView('news'); }
      if (e.key === 'F5') { e.preventDefault(); useUIStore.getState().setActiveView('ai'); }
      if (e.key === 'F6') { e.preventDefault(); useUIStore.getState().setActiveView('backtesting'); }
      if (e.key === 'F7') { e.preventDefault(); useUIStore.getState().setActiveView('vip'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleCommandPalette, openCommandPalette]);

  const renderView = () => {
    switch (activeView) {
      case 'terminal':    return <TerminalView />;
      case 'macro':       return <MacroView />;
      case 'screener':    return <ScreenerView />;
      case 'news':        return <div className="h-full overflow-hidden"><NewsPanel /></div>;
      case 'ai':          return <div className="h-full overflow-hidden"><AIAnalyst /></div>;
      case 'backtesting': return <BacktestingView />;
      case 'vip':         return <VIPDashboard />;
      default:            return <TerminalView />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-[#e8e8e8] overflow-hidden">
      {/* Top Bar */}
      <TopBar />

      {/* Ticker Tape */}
      <TickerTape />

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden bg-[#0a0a0a]">
          {renderView()}
        </main>
      </div>

      {/* Command Palette Overlay */}
      <CommandPalette />
    </div>
  );
}

// ─── Root App with Providers ─────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
