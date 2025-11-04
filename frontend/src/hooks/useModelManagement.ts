import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  scanLocalModels,
  deleteModel,
  discoverModels,
  ModelSearchFilters,
  DiscoveredModel,
  getModelInfo,
} from '../services/api';
import { useErrorHandler } from './useErrorHandler';

/**
 * Hook to scan local models
 */
export function useScanLocalModels() {
  const queryClient = useQueryClient();
  const { handleError, handleSuccess } = useErrorHandler('Models');
  
  return useMutation({
    mutationFn: scanLocalModels,
    onSuccess: (result) => {
      handleSuccess(result.message);
      // Invalidate models query to refetch
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
    onError: handleError,
  });
}

/**
 * Hook to delete a model
 */
export function useDeleteModel() {
  const queryClient = useQueryClient();
  const { handleError, handleSuccess } = useErrorHandler('Models');
  
  return useMutation({
    mutationFn: deleteModel,
    onSuccess: () => {
      handleSuccess('Model deleted successfully');
      // Invalidate models query to refetch
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
    onError: handleError,
  });
}

/**
 * Hook to discover models
 */
export function useDiscoverModels(filters: ModelSearchFilters, enabled = true) {
  return useQuery<DiscoveredModel[]>({
    queryKey: ['discover-models', filters],
    queryFn: () => discoverModels(filters),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to get model info
 */
export function useModelInfo(executorName: string, modelName: string | null, enabled = true) {
  return useQuery({
    queryKey: ['model-info', executorName, modelName],
    queryFn: () => getModelInfo(executorName, modelName!),
    enabled: enabled && !!modelName,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
