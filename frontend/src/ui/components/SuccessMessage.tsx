import { useEffect } from 'react';

interface SuccessMessageProps {
  message: string | null;
  onDismiss?: () => void;
  autoHide?: boolean;
  duration?: number;
}

/**
 * Reusable success message component
 */
export function SuccessMessage({ 
  message, 
  onDismiss, 
  autoHide = true,
  duration = 3000 
}: SuccessMessageProps) {
  useEffect(() => {
    if (message && autoHide && onDismiss) {
      const timer = setTimeout(() => {
        onDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [message, autoHide, duration, onDismiss]);

  if (!message) return null;

  return (
    <div className="glass" style={{
      padding: '1rem',
      borderRadius: 'var(--radius-xl)',
      backgroundColor: 'var(--success-bg)',
      border: '1px solid var(--success)',
      color: 'var(--success)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
        <span style={{ fontSize: '1.25rem' }}>✅</span>
        <span style={{ fontSize: '0.875rem' }}>{message}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            padding: '0.25rem 0.5rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--success)',
            fontSize: '1.25rem',
            lineHeight: 1,
            borderRadius: 'var(--radius-sm)',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
          aria-label="Dismiss success message"
        >
          ✕
        </button>
      )}
    </div>
  );
}
