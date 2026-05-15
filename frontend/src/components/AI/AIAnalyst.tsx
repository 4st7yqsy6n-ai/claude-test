import { useState, useRef, useEffect, useCallback } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { askAI } from '@/lib/api';
import type { AIMessage } from '@/types';
import { Send, BarChart2, TrendingUp, AlertTriangle, Search } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

const QUICK_ACTIONS = [
  { icon: BarChart2, label: 'Market Briefing', prompt: 'Give me a comprehensive market briefing for today. Cover major indices, key macro themes, and notable movers.' },
  { icon: Search, label: 'Analyze Symbol', prompt: null }, // Dynamic
  { icon: TrendingUp, label: 'Trade Ideas', prompt: 'Based on current market conditions, what are 3 high-conviction trade ideas? Include rationale, entry levels, targets, and risk management.' },
  { icon: AlertTriangle, label: 'Risk Check', prompt: 'What are the key macro and market risks I should be aware of right now? Rank them by probability and potential impact.' },
];

function formatAIContent(content: string): React.ReactNode {
  const lines = content.split('\n');
  return lines.map((line, i) => {
    // Bold headers (lines starting with ** or ##)
    if (line.startsWith('## ') || line.startsWith('**') && line.endsWith('**')) {
      const text = line.replace(/^##\s*/, '').replace(/\*\*/g, '');
      return (
        <div key={i} className="text-[#ff6600] font-bold font-mono text-xs mt-3 mb-1 tracking-wider">
          {text}
        </div>
      );
    }
    // Bullet points
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return (
        <div key={i} className="flex gap-2 text-xs mb-0.5">
          <span className="text-[#ff6600] shrink-0 mt-0.5">›</span>
          <span className="text-[#cccccc]">{line.slice(2)}</span>
        </div>
      );
    }
    // Bold text inline
    if (line.includes('**')) {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <p key={i} className="text-xs text-[#bbbbbb] mb-1 leading-relaxed">
          {parts.map((part, j) =>
            j % 2 === 1 ? <strong key={j} className="text-[#e8e8e8]">{part}</strong> : part
          )}
        </p>
      );
    }
    // Empty line
    if (line.trim() === '') return <div key={i} className="h-1.5" />;
    // Regular text
    return <p key={i} className="text-xs text-[#bbbbbb] mb-0.5 leading-relaxed">{line}</p>;
  });
}

const MOCK_RESPONSES: Record<string, string> = {
  default: `## Market Intelligence Analysis

**Current Market Regime:** Risk-On with Selective Rotation

The equity markets are showing **bullish momentum** with the S&P 500 testing the 5,850 resistance zone. Breadth is improving with small-caps outperforming.

## Key Observations:

- **Tech sector** continues to lead, driven by AI infrastructure spending
- **Bond yields** remain elevated, creating headwinds for rate-sensitive sectors
- **Dollar strength** is pressuring emerging markets and commodities
- **VIX** at 14.8 suggests complacency — watch for potential volatility spikes

## Risk Factors:

- Fed remaining data-dependent with no clear rate cut timeline
- Elevated valuations (S&P P/E ~22x vs historical ~17x)
- Geopolitical tensions affecting energy markets

**Disclaimer:** This analysis is for educational purposes only. Not financial advice.`,
};

export default function AIAnalyst() {
  const { selectedSymbol } = useMarketStore();
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: `## QUANT∞ AI ANALYST ONLINE

Welcome to the AI Analyst terminal. I can help you with:

- **Market analysis** and macro commentary
- **Technical analysis** for any symbol
- **Trade ideas** based on current conditions
- **Risk assessment** and portfolio considerations

Use the quick action buttons above or type your question below.

*Powered by Claude • Data as of ${format(new Date(), 'MMM dd, yyyy HH:mm')} ET*`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMsg: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    const loadingMsg: AIMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const response = await askAI(content.trim(), history);

      setMessages((prev) => [
        ...prev.filter((m) => !m.isLoading),
        {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        },
      ]);
    } catch {
      // Use mock response when backend unavailable
      const mockKey = content.toLowerCase().includes('brief') ? 'default'
        : content.toLowerCase().includes('risk') ? 'default'
        : 'default';

      const mockResponse = MOCK_RESPONSES[mockKey] ?? `## Analysis for ${content.includes(selectedSymbol) ? selectedSymbol : 'Current Markets'}

Based on current market data and technicals:

**Summary:** Markets are in a **cautiously bullish** regime with strong momentum in large-cap tech. The current macro environment favors quality growth over value.

**Key Levels to Watch:**
- S&P 500 support: 5,750 | Resistance: 5,900
- 10Y yield: 4.0% (pivot) | 4.5% (ceiling)
- VIX: >20 signals risk-off, <13 signals complacency

**Recommendation:** Maintain equity exposure but hedge tail risks via options. Favor tech, healthcare, and select industrials.

*Note: Backend unavailable — this is a demonstration response. Connect to live backend for real AI analysis.*`;

      setTimeout(() => {
        setMessages((prev) => [
          ...prev.filter((m) => !m.isLoading),
          {
            id: (Date.now() + 2).toString(),
            role: 'assistant',
            content: mockResponse,
            timestamp: new Date(),
          },
        ]);
        setIsLoading(false);
      }, 1500 + Math.random() * 1000);
      return;
    }

    setIsLoading(false);
  }, [isLoading, messages, selectedSymbol]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickAction = (action: typeof QUICK_ACTIONS[number]) => {
    const prompt = action.prompt ?? `Perform a comprehensive technical and fundamental analysis of ${selectedSymbol}. Include key levels, recent catalysts, and short-term outlook.`;
    sendMessage(prompt);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1f1f1f] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-[#ff6600]/20 border border-[#ff6600]/40 rounded flex items-center justify-center">
            <span className="text-[#ff6600] text-xs">AI</span>
          </div>
          <div>
            <div className="text-[#ff6600] font-mono text-[10px] font-bold tracking-widest">AI ANALYST</div>
            <div className="text-[#555555] font-mono text-[9px]">Powered by Claude • {selectedSymbol} context active</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00d37f] animate-pulse" />
            <span className="text-[#00d37f] font-mono text-[9px]">ONLINE</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-2 border-b border-[#1a1a1a] flex gap-2 shrink-0 overflow-x-auto">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          const label = action.label === 'Analyze Symbol'
            ? `Analyze ${selectedSymbol}`
            : action.label;
          return (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action)}
              disabled={isLoading}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded font-mono text-[10px] text-[#888888] hover:text-[#ff6600] hover:border-[#ff6600]/40 hover:bg-[#ff6600]/5 transition-all whitespace-nowrap',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Icon size={11} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={clsx(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div className={clsx(
              'max-w-[90%] rounded p-3',
              msg.role === 'user'
                ? 'bg-[#1f1f1f] border border-[#2a2a2a]'
                : 'bg-[#141414] border border-[#1f1f1f]'
            )}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-3 h-3 bg-[#ff6600]/30 border border-[#ff6600]/50 rounded-sm flex items-center justify-center">
                    <span className="text-[#ff6600] text-[6px] font-bold">AI</span>
                  </div>
                  <span className="text-[#ff6600] font-mono text-[9px] font-bold">ANALYST</span>
                  <span className="text-[#333333] font-mono text-[9px]">
                    {format(msg.timestamp, 'HH:mm:ss')}
                  </span>
                </div>
              )}

              {msg.isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#ff6600] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#ff6600] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-[#ff6600] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-[#ff6600] font-mono text-xs animate-blink">ANALYZING...</span>
                </div>
              ) : (
                <div className="text-left">
                  {msg.role === 'user' ? (
                    <p className="text-sm text-[#e8e8e8] font-sans">{msg.content}</p>
                  ) : (
                    <div className="space-y-0.5">
                      {formatAIContent(msg.content)}
                    </div>
                  )}
                </div>
              )}

              {msg.role === 'user' && (
                <div className="text-right mt-1">
                  <span className="text-[#333333] font-mono text-[9px]">
                    {format(msg.timestamp, 'HH:mm:ss')}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-[#1f1f1f] shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the AI Analyst... (e.g., 'Analyze NVDA technicals')"
            disabled={isLoading}
            className={clsx(
              'flex-1 bg-[#1a1a1a] border border-[#2a2a2a] text-[#e8e8e8] font-mono text-xs px-3 py-2 rounded focus:outline-none focus:border-[#ff6600]/60 placeholder-[#444444] transition-colors',
              isLoading && 'opacity-50'
            )}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className={clsx(
              'px-3 py-2 bg-[#ff6600] text-black rounded font-bold transition-all',
              (isLoading || !input.trim()) ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#ff7a1a]'
            )}
          >
            <Send size={14} />
          </button>
        </form>
        <div className="mt-1.5 text-[#333333] font-mono text-[9px] text-center">
          For educational purposes only. Not financial advice. Always do your own research.
        </div>
      </div>
    </div>
  );
}
