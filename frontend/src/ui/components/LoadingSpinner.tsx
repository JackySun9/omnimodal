interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  fullPage?: boolean;
}

/**
 * Reusable loading spinner component
 */
export function LoadingSpinner({ size = 'md', message, fullPage = false }: LoadingSpinnerProps) {
  const sizeMap = {
    sm: '1.5rem',
    md: '3rem',
    lg: '5rem',
  };

  const spinner = (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: '1rem',
      ...(fullPage ? { 
        padding: '3rem',
        justifyContent: 'center',
        minHeight: '400px',
      } : {})
    }}>
      <div 
        className="loading shimmer" 
        style={{ 
          width: sizeMap[size], 
          height: sizeMap[size], 
          borderRadius: '50%',
          margin: '0 auto',
        }}
      />
      {message && (
        <p style={{ 
          margin: 0, 
          color: 'var(--text-secondary)',
          fontSize: size === 'sm' ? '0.875rem' : '1rem',
        }}>
          {message}
        </p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fade-in" style={{ 
        padding: '2rem', 
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100%',
      }}>
        {spinner}
      </div>
    );
  }

  return spinner;
}
