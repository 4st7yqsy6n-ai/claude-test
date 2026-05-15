import { useQuery } from '@tanstack/react-query';
import { fetchMarketOverview, fetchOHLCV, getScreenerMovers, getHeatmapData } from '@/lib/api';
import type { Timeframe } from '@/types';

export function useMarketOverview() {
  return useQuery({
    queryKey: ['market', 'overview'],
    queryFn: fetchMarketOverview,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  });
}

export function useOHLCV(symbol: string, timeframe: Timeframe = '1D') {
  return useQuery({
    queryKey: ['market', 'ohlcv', symbol, timeframe],
    queryFn: () => fetchOHLCV(symbol, timeframe),
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: !!symbol,
    retry: false,
  });
}

export function useScreenerMovers(type: 'gainers' | 'losers' = 'gainers') {
  return useQuery({
    queryKey: ['screener', 'movers', type],
    queryFn: () => getScreenerMovers(type),
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  });
}

export function useHeatmapData() {
  return useQuery({
    queryKey: ['screener', 'heatmap'],
    queryFn: getHeatmapData,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });
}
