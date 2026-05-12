import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiResponse, ProductHunt } from '@/types';

interface ProductHuntParams {
  day?: string;
  limit?: number;
  offset?: number;
}

export function useProductHunt(params: ProductHuntParams = {}) {
  return useQuery<ApiResponse<ProductHunt>, Error>({
    queryKey: ['producthunt', params],
    queryFn: () => api.getProductHunt(params),
  });
}

export function useCategories() {
  return useQuery<string[], Error>({
    queryKey: ['categories'],
    queryFn: api.getCategories,
  });
}

export function useFetchProductHunt() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, Error, { day?: string }>({
    mutationFn: api.fetchProductHunt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producthunt'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}
