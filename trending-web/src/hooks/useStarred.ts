import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiResponse, GitHubStarred } from '@/types';

interface StarredParams {
  username: string;
  language?: string;
  limit?: number;
  offset?: number;
  sort?: string;
}

export function useStarred(params: StarredParams) {
  return useQuery<ApiResponse<GitHubStarred>, Error>({
    queryKey: ['starred', params],
    queryFn: () => api.getStarred(params.username, {
      language: params.language,
      limit: params.limit,
      offset: params.offset,
      sort: params.sort,
    }),
    enabled: !!params.username,
  });
}

export function useUserLanguages(username: string) {
  return useQuery<Record<string, number>, Error>({
    queryKey: ['user-languages', username],
    queryFn: () => api.getUserLanguages(username),
    enabled: !!username,
  });
}

export function useFetchStarred() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, Error, { username: string }>({
    mutationFn: api.fetchStarred,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['starred'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}
