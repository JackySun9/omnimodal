import { useCallback } from 'react';
import { ErrorHandler } from '../utils/errorHandler';

/**
 * Hook for centralized error handling
 */
export function useErrorHandler(context?: string) {
  const handleError = useCallback(
    (error: unknown, customMessage?: string) => {
      if (customMessage) {
        ErrorHandler.showError(customMessage, context);
        return customMessage;
      }
      const errorMsg = ErrorHandler.handleApiError(error);
      ErrorHandler.showError(errorMsg, context);
      return errorMsg;
    },
    [context]
  );

  const handleSuccess = useCallback(
    (message: string) => {
      ErrorHandler.showSuccess(message);
    },
    []
  );

  const handleInfo = useCallback(
    (message: string) => {
      ErrorHandler.showInfo(message);
    },
    []
  );

  const handleLoading = useCallback(
    (message: string) => {
      return ErrorHandler.showLoading(message);
    },
    []
  );

  return {
    handleError,
    handleSuccess,
    handleInfo,
    handleLoading,
    showError: handleError,
    showSuccess: handleSuccess,
    showInfo: handleInfo,
    showLoading: handleLoading,
  };
}
