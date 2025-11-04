import React from 'react';
import toast from 'react-hot-toast';

interface RetryToastProps {
  message: string;
  onRetry: () => void;
  toastId: string;
}

/**
 * Toast component with retry button
 */
export const RetryToast: React.FC<RetryToastProps> = ({ message, onRetry, toastId }) => {
  const handleRetry = () => {
    toast.dismiss(toastId);
    onRetry();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span>{message}</span>
      <button
        onClick={handleRetry}
        style={{
          padding: '6px 12px',
          background: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500',
        }}
      >
        Try Again
      </button>
    </div>
  );
};

/**
 * Show an error toast with retry button
 */
export function showRetryToast(message: string, onRetry: () => void): string {
  return toast.error(
    (t) => <RetryToast message={message} onRetry={onRetry} toastId={t.id} />,
    { duration: 8000 }
  );
}
