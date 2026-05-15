import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DashboardStats } from '@/types';

export function useStats() {
  return useQuery<DashboardStats, Error>({
    queryKey: ['stats'],
    queryFn: api.getStats,
    refetchInterval: 30000,
  });
}
