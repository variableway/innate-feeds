import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiResponse, GitHubTrending } from '@/types';

interface TrendingParams {
  period?: string;
  language?: string;
  limit?: number;
  offset?: number;
}

export function useTrending(params: TrendingParams = {}) {
  return useQuery<ApiResponse<GitHubTrending>, Error>({
    queryKey: ['trending', params],
    queryFn: () => api.getTrending(params),
  });
}

export function useLanguages() {
  return useQuery<string[], Error>({
    queryKey: ['languages'],
    queryFn: api.getLanguages,
  });
}

export function useFetchTrending() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, Error, { period?: string; language?: string }>({
    mutationFn: api.fetchTrending,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trending'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}
