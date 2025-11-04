import { useMutation } from '@tanstack/react-query';
import { executeJob, ExecutionRequest, ExecutionResponse } from '../services/api';
import { ErrorHandler } from '../utils/errorHandler';

/**
 * Hook for executing jobs
 */
export function useJobExecution(executorName: string) {
  return useMutation({
    mutationFn: (request: ExecutionRequest) => executeJob(executorName, request),
    onError: (error) => {
      const errorMsg = ErrorHandler.handleApiError(error);
      ErrorHandler.showError(errorMsg, executorName);
    },
  });
}

/**
 * Hook for executing jobs with custom error handling
 */
export function useJobExecutionWithCallback(
  executorName: string,
  options?: {
    onSuccess?: (response: ExecutionResponse) => void;
    onError?: (error: unknown) => void;
  }
) {
  return useMutation({
    mutationFn: (request: ExecutionRequest) => executeJob(executorName, request),
    onSuccess: options?.onSuccess,
    onError: (error) => {
      const errorMsg = ErrorHandler.handleApiError(error);
      ErrorHandler.showError(errorMsg, executorName);
      options?.onError?.(error);
    },
  });
}
