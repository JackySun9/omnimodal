import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  startExecutor,
  loadModelIntoExecutor,
} from '../services/api';
import { useErrorHandler } from './useErrorHandler';

/**
 * Hook to start an executor
 */
export function useStartExecutor() {
  const queryClient = useQueryClient();
  const { handleError, handleSuccess } = useErrorHandler('Executor');
  
  return useMutation({
    mutationFn: (executorName: string) => startExecutor(executorName),
    onSuccess: (_, executorName) => {
      handleSuccess(`${executorName} started successfully`);
      // Invalidate executor status to refetch
      queryClient.invalidateQueries({ queryKey: ['executor-status', executorName] });
    },
    onError: handleError,
  });
}

/**
 * Hook to load model into executor
 */
export function useLoadModelIntoExecutor() {
  const queryClient = useQueryClient();
  const { handleError, handleSuccess } = useErrorHandler('Executor');
  
  return useMutation({
    mutationFn: ({ executorName, modelName }: { executorName: string; modelName: string }) =>
      loadModelIntoExecutor(executorName, modelName),
    onSuccess: (_, { executorName }) => {
      handleSuccess('Model loaded successfully');
      // Invalidate executor status and model info
      queryClient.invalidateQueries({ queryKey: ['executor-status', executorName] });
      queryClient.invalidateQueries({ queryKey: ['model-info'] });
    },
    onError: handleError,
  });
}
