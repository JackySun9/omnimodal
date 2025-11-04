import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSTTExecutors,
  getSTTModels,
  STTExecutorsResponse,
  STTModelsResponse,
  loadSTTModel,
} from '../services/api';

/**
 * Hook to fetch STT executors
 */
export function useSTTExecutors() {
  return useQuery<STTExecutorsResponse>({
    queryKey: ['stt-executors'],
    queryFn: getSTTExecutors,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to fetch STT models
 */
export function useSTTModelsList() {
  return useQuery<STTModelsResponse>({
    queryKey: ['stt-models'],
    queryFn: getSTTModels,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Hook to load STT model
 */
export function useLoadSTTModel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ executorName, modelSize }: { executorName: string; modelSize: string }) =>
      loadSTTModel(executorName, modelSize),
    onSuccess: () => {
      // Invalidate executor status to reflect new model
      queryClient.invalidateQueries({ queryKey: ['executor-status'] });
    },
  });
}
