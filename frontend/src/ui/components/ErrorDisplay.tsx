import { useEffect } from 'react';

interface ErrorDisplayProps {
  error: string | null;
  onDismiss?: () => void;
  context?: string;
}

/**
 * Reusable error display component
 */
export function ErrorDisplay({ error, onDismiss, context }: ErrorDisplayProps) {
  if (!error) return null;

  return (
    <div className="glass" style={{
      padding: '1rem',
      borderRadius: 'var(--radius-xl)',
      backgroundColor: 'var(--error-bg)',
      border: '1px solid var(--error)',
      color: 'var(--error)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
        <span style={{ fontSize: '1.25rem' }}>⚠️</span>
        <span style={{ fontSize: '0.875rem' }}>
          {context && <strong>[{context}] </strong>}
          {error}
        </span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            padding: '0.25rem 0.5rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--error)',
            fontSize: '1.25rem',
            lineHeight: 1,
            borderRadius: 'var(--radius-sm)',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
          aria-label="Dismiss error"
        >
          ✕
        </button>
      )}
    </div>
  );
}
