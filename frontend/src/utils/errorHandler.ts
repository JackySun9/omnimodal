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
          if ('detail' in data && typeof data.detail === 'string') {
            return data.detail;
          }
          if ('error' in data && typeof data.error === 'string') {
            return data.error;
          }
          if ('message' in data && typeof data.message === 'string') {
            return data.message;
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
          case 500:
            return 'Server error. Please try again later.';
          case 503:
            return 'Service temporarily unavailable.';
          default:
            return `Request failed with status ${status}`;
        }
      } else if (error.request) {
        // Request made but no response received
        return 'Network error. Please check your connection.';
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
}
