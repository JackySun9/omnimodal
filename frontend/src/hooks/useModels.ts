import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchLocalModels,
  LocalModel,
  getExecutorStatus,
  ExecutorStatus,
  scheduleDownload,
  CreateModelPayload,
} from '../services/api';

/**
 * Hook to fetch all local models
 */
export function useModels() {
  return useQuery<LocalModel[]>({
    queryKey: ['models'],
    queryFn: fetchLocalModels,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch models filtered by modality
 */
export function useModelsByModality(modality: string) {
  const { data: allModels, ...rest } = useModels();
  
  return {
    ...rest,
    models: allModels?.filter(m => m.modality === modality) || [],
  };
}

/**
 * Hook for text models
 */
export function useTextModels() {
  return useModelsByModality('text');
}

/**
 * Hook for image models
 */
export function useImageModels() {
  return useModelsByModality('image');
}

/**
 * Hook for STT models
 */
export function useSTTModels() {
  return useModelsByModality('stt');
}

/**
 * Hook to check executor status
 */
export function useExecutorStatus(executorName: string) {
  return useQuery<ExecutorStatus>({
    queryKey: ['executor-status', executorName],
    queryFn: () => getExecutorStatus(executorName),
    refetchInterval: 5000, // Poll every 5 seconds
    retry: 1,
  });
}

/**
 * Hook to schedule model download
 */
export function useScheduleDownload() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload: CreateModelPayload) => scheduleDownload(payload),
    onSuccess: () => {
      // Invalidate models and downloads queries to refetch
      queryClient.invalidateQueries({ queryKey: ['models'] });
      queryClient.invalidateQueries({ queryKey: ['downloads'] });
    },
  });
}

/**
 * Hook to refresh models
 */
export function useRefreshModels() {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['models'] });
  };
}
