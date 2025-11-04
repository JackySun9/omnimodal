import toast from 'react-hot-toast';
import axios from 'axios';

/**
 * Centralized error handling utility
 */
export class ErrorHandler {
  /**
   * Display an error message using toast notifications
   */
  static showError(error: Error | string, context?: string): void {
    const message = typeof error === 'string' ? error : error.message;
    const fullMessage = context ? `[${context}] ${message}` : message;
    
    console.error(fullMessage, error instanceof Error ? error : undefined);
    
    toast.error(fullMessage, {
      duration: 5000,
    });
  }
  
  /**
   * Handle API errors and extract user-friendly messages
   */
  static handleApiError(error: unknown): string {
    // Handle axios errors
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // Server responded with error status
        const status = error.response.status;
        const data = error.response.data;
        
        if (typeof data === 'object' && data !== null) {
          // Check for various error message fields
          if ('detail' in data && typeof data.detail === 'string') {
            return data.detail;
          }
          if ('error' in data && typeof data.error === 'string') {
            return data.error;
          }
          if ('message' in data && typeof data.message === 'string') {
            return data.message;
          }
          // Check for validation errors (FastAPI format)
          if ('detail' in data && Array.isArray(data.detail)) {
            const validationErrors = data.detail
              .map((err: any) => `${err.loc?.join('.')}: ${err.msg}`)
              .join(', ');
            return `Validation error: ${validationErrors}`;
          }
        }
        
        // Status-based messages
        switch (status) {
          case 400:
            return 'Invalid request. Please check your input.';
          case 401:
            return 'Unauthorized. Please check your credentials.';
          case 403:
            return 'Access forbidden.';
          case 404:
            return 'Resource not found.';
          case 408:
            return 'Request timeout. Please try again.';
          case 429:
            return 'Too many requests. Please wait a moment.';
          case 500:
            return 'Server error. Please try again later.';
          case 502:
            return 'Bad gateway. The service may be temporarily unavailable.';
          case 503:
            return 'Service temporarily unavailable. Please try again later.';
          case 504:
            return 'Gateway timeout. The request took too long.';
          default:
            return `Request failed with status ${status}`;
        }
      } else if (error.request) {
        // Request made but no response received
        if (error.code === 'ECONNABORTED') {
          return 'Request timeout. Please check your connection and try again.';
        }
        if (error.code === 'ERR_NETWORK') {
          return 'Network error. Please check your internet connection.';
        }
        return 'Network error. Unable to reach the server.';
      }
    }
    
    // Handle standard Error objects
    if (error instanceof Error) {
      return error.message;
    }
    
    // Handle string errors
    if (typeof error === 'string') {
      return error;
    }
    
    // Handle objects with error messages
    if (error && typeof error === 'object') {
      if ('message' in error && typeof error.message === 'string') {
        return error.message;
      }
      if ('error' in error && typeof error.error === 'string') {
        return error.error;
      }
    }
    
    return 'An unexpected error occurred';
  }
  
  /**
   * Display success message
   */
  static showSuccess(message: string): void {
    toast.success(message, {
      duration: 4000,
    });
  }
  
  /**
   * Display info message
   */
  static showInfo(message: string): void {
    toast(message, {
      icon: 'ℹ️',
      duration: 4000,
    });
  }
  
  /**
   * Display warning message
   */
  static showWarning(message: string): void {
    toast(message, {
      icon: '⚠️',
      duration: 4000,
      style: {
        background: '#fef3c7',
        color: '#92400e',
      },
    });
  }
  
  /**
   * Display loading toast and return toast ID
   */
  static showLoading(message: string): string {
    return toast.loading(message);
  }
  
  /**
   * Update a loading toast to success
   */
  static updateToSuccess(toastId: string, message: string): void {
    toast.success(message, { id: toastId });
  }
  
  /**
   * Update a loading toast to error
   */
  static updateToError(toastId: string, message: string): void {
    toast.error(message, { id: toastId });
  }
  
  /**
   * Update a loading toast to info
   */
  static updateToInfo(toastId: string, message: string): void {
    toast(message, { id: toastId, icon: 'ℹ️' });
  }
  
  /**
   * Dismiss a toast
   */
  static dismiss(toastId: string): void {
    toast.dismiss(toastId);
  }
  
  /**
   * Dismiss all toasts
   */
  static dismissAll(): void {
    toast.dismiss();
  }
  
  /**
   * Log error to console in development mode
   */
  static logError(error: unknown, context?: string): void {
    if (process.env.NODE_ENV === 'development') {
      console.group(`Error ${context ? `in ${context}` : ''}`);
      console.error(error);
      if (error instanceof Error && error.stack) {
        console.error('Stack trace:', error.stack);
      }
      console.groupEnd();
    }
  }
  
  /**
   * Create a user-friendly error message with retry suggestion
   * Note: For retry functionality, use showRetryToast from @/ui/components/RetryToast
   */
  static createRetryMessage(baseMessage: string, retryAction?: () => void): void {
    toast.error(baseMessage, { duration: 6000 });
    
    // Note: To show a retry button, import and use:
    // import { showRetryToast } from '@/ui/components/RetryToast';
    // showRetryToast(message, () => retryAction());
  }
}
