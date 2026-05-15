import { useState } from 'react';
import { useNews } from '@/hooks/useMacroData';
import { formatDistanceToNow } from 'date-fns';
import type { NewsCategory, NewsItem } from '@/types';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

type TabType = 'all' | NewsCategory;

const TABS: { key: TabType; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'macro', label: 'MACRO' },
  { key: 'fx', label: 'FX' },
  { key: 'equity', label: 'EQUITY' },
  { key: 'crypto', label: 'CRYPTO' },
];

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  macro:       { bg: 'bg-blue-500/15',   text: 'text-blue-400',   border: 'border-blue-400/30' },
  fx:          { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-400/30' },
  equity:      { bg: 'bg-green-500/15',  text: 'text-green-400',  border: 'border-green-400/30' },
  crypto:      { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-400/30' },
  rates:       { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-400/30' },
  commodities: { bg: 'bg-amber-500/15',  text: 'text-amber-400',  border: 'border-amber-400/30' },
  general:     { bg: 'bg-gray-500/15',   text: 'text-gray-400',   border: 'border-gray-400/30' },
};

const SENTIMENT_STYLES: Record<string, string> = {
  bullish: 'text-[#00d37f]',
  bearish: 'text-[#ff3b3b]',
  neutral: 'text-[#888888]',
};

function NewsItemCard({ item, compact = false }: { item: NewsItem; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const catStyle = CATEGORY_STYLES[item.category] ?? CATEGORY_STYLES.general;
  const sentimentStyle = SENTIMENT_STYLES[item.sentiment ?? 'neutral'];
  const timeAgo = formatDistanceToNow(new Date(item.published_at), { addSuffix: true });

  return (
    <div
      className={clsx(
        'border-b border-[#1a1a1a] hover:bg-[#141414] transition-colors cursor-pointer',
        compact ? 'px-3 py-2.5' : 'px-4 py-3',
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={clsx(
              'font-mono text-[9px] px-1.5 py-0.5 rounded border',
              catStyle.bg, catStyle.text, catStyle.border
            )}>
              {item.category.toUpperCase()}
            </span>
            <span className="text-[#888888] font-mono text-[9px]">
              {item.source}
            </span>
            <span className="text-[#444444] font-mono text-[9px]">{timeAgo}</span>
            {item.sentiment && (
              <span className={clsx('font-mono text-[9px] font-bold', sentimentStyle)}>
                {item.sentiment === 'bullish' ? '▲ BULLISH' : item.sentiment === 'bearish' ? '▼ BEARISH' : '— NEUTRAL'}
              </span>
            )}
          </div>

          <p className={clsx(
            'font-sans text-[#e8e8e8] leading-snug',
            compact ? 'text-xs' : 'text-sm'
          )}>
            {item.headline}
          </p>

          {expanded && item.summary && (
            <p className="mt-2 text-[#888888] font-sans text-xs leading-relaxed border-l-2 border-[#ff6600]/40 pl-3">
              {item.summary}
            </p>
          )}

          {expanded && item.symbols && item.symbols.length > 0 && (
            <div className="mt-2 flex gap-1.5 flex-wrap">
              {item.symbols.map((sym) => (
                <span key={sym} className="font-mono text-[9px] text-[#ff6600] bg-[#ff6600]/10 border border-[#ff6600]/20 px-1.5 py-0.5 rounded">
                  {sym}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-[#444444]">
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="hover:text-[#ff6600] transition-colors p-0.5"
            >
              <ExternalLink size={10} />
            </a>
          )}
          {item.summary && (
            expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />
          )}
        </div>
      </div>
    </div>
  );
}

function SkeletonNews() {
  return (
    <div className="px-4 py-3 border-b border-[#1a1a1a] animate-pulse">
      <div className="flex gap-2 mb-2">
        <div className="h-4 bg-[#1f1f1f] rounded w-12" />
        <div className="h-4 bg-[#1f1f1f] rounded w-20" />
      </div>
      <div className="h-4 bg-[#1f1f1f] rounded w-full mb-1" />
      <div className="h-4 bg-[#1f1f1f] rounded w-3/4" />
    </div>
  );
}

interface NewsPanelProps {
  compact?: boolean;
}

export default function NewsPanel({ compact = false }: NewsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const { data: news, isLoading } = useNews(activeTab === 'all' ? undefined : activeTab);

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1f1f1f] shrink-0">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[#ff6600] font-mono text-[10px] font-bold tracking-widest">MARKET NEWS</span>
          <span className="text-[#444444] font-mono text-[9px]">auto-refresh 5min</span>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'px-2.5 py-1 font-mono text-[10px] rounded transition-all',
                activeTab === tab.key
                  ? 'bg-[#ff6600] text-black font-bold'
                  : 'text-[#888888] hover:text-[#e8e8e8] hover:bg-[#1a1a1a]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* News List */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          Array.from({ length: compact ? 4 : 8 }).map((_, i) => <SkeletonNews key={i} />)
        ) : (
          (news ?? []).map((item) => (
            <NewsItemCard key={item.id} item={item} compact={compact} />
          ))
        )}

        {!isLoading && (news ?? []).length === 0 && (
          <div className="flex items-center justify-center h-32 text-[#444444] font-mono text-sm">
            No news available
          </div>
        )}
      </div>
    </div>
  );
}
