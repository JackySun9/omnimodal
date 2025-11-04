import { useCallback } from 'react';
import { ErrorHandler } from '../utils/errorHandler';

/**
 * Hook for centralized error handling with retry support
 */
export function useErrorHandler(context?: string) {
  const handleError = useCallback(
    (error: unknown, customMessage?: string) => {
      ErrorHandler.logError(error, context);
      
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

  const handleErrorWithRetry = useCallback(
    (error: unknown, retryAction: () => void, customMessage?: string) => {
      ErrorHandler.logError(error, context);
      
      const errorMsg = customMessage || ErrorHandler.handleApiError(error);
      
      // For now, just show the error. To add retry functionality:
      // import { showRetryToast } from '@/ui/components/RetryToast';
      // showRetryToast(errorMsg, retryAction);
      ErrorHandler.createRetryMessage(errorMsg, retryAction);
      
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

  const handleWarning = useCallback(
    (message: string) => {
      ErrorHandler.showWarning(message);
    },
    []
  );

  const handleLoading = useCallback(
    (message: string) => {
      return ErrorHandler.showLoading(message);
    },
    []
  );

  const updateToSuccess = useCallback(
    (toastId: string, message: string) => {
      ErrorHandler.updateToSuccess(toastId, message);
    },
    []
  );

  const updateToError = useCallback(
    (toastId: string, message: string) => {
      ErrorHandler.updateToError(toastId, message);
    },
    []
  );

  return {
    handleError,
    handleErrorWithRetry,
    handleSuccess,
    handleInfo,
    handleWarning,
    handleLoading,
    updateToSuccess,
    updateToError,
    showError: handleError,
    showSuccess: handleSuccess,
    showInfo: handleInfo,
    showWarning: handleWarning,
    showLoading: handleLoading,
  };
}
