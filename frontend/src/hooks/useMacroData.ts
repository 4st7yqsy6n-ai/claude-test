import { useQuery } from '@tanstack/react-query';
import { fetchMacroIndicators, fetchYieldCurve, fetchNews, getEconomicCalendar } from '@/lib/api';
import type { NewsCategory } from '@/types';

export function useMacroIndicators() {
  return useQuery({
    queryKey: ['macro', 'indicators'],
    queryFn: fetchMacroIndicators,
    refetchInterval: 5 * 60_000, // 5 minutes
    staleTime: 2 * 60_000,
    retry: false,
  });
}

export function useYieldCurve() {
  return useQuery({
    queryKey: ['macro', 'yield-curve'],
    queryFn: fetchYieldCurve,
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
    retry: false,
  });
}

export function useNews(category?: NewsCategory | 'all') {
  return useQuery({
    queryKey: ['news', category ?? 'all'],
    queryFn: () => fetchNews(category),
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
    retry: false,
  });
}

export function useEconomicCalendar() {
  return useQuery({
    queryKey: ['calendar'],
    queryFn: getEconomicCalendar,
    refetchInterval: 15 * 60_000,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
