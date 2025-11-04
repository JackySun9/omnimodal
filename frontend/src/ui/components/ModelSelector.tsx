import { LocalModel } from '../../services/api';

interface ModelSelectorProps {
  models: LocalModel[];
  selectedModel: LocalModel | null;
  onSelect: (model: LocalModel) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  formatModelName?: (name: string) => string;
  highlightColor?: string;
  variant?: 'default' | 'compact';
}

/**
 * Reusable model selector component
 */
export function ModelSelector({
  models,
  selectedModel,
  onSelect,
  onRefresh,
  isLoading = false,
  formatModelName = (name) => name,
  highlightColor = 'var(--primary-color)',
  variant = 'default',
}: ModelSelectorProps) {
  if (models.length === 0) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <p style={{ fontSize: '0.875rem' }}>No models available</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto' }}>
      {models.map((model) => (
        <button
          key={model.id}
          onClick={() => onSelect(model)}
          style={{
            padding: variant === 'compact' ? '0.5rem 0.75rem' : '0.75rem 1rem',
            textAlign: 'left',
            background: selectedModel?.id === model.id
              ? `linear-gradient(135deg, ${highlightColor}15, ${highlightColor}08)`
              : 'var(--bg-secondary)',
            border: selectedModel?.id === model.id
              ? `2px solid ${highlightColor}`
              : '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: selectedModel?.id === model.id
              ? `0 2px 8px ${highlightColor}20`
              : '0 1px 2px rgba(0, 0, 0, 0.05)',
            width: '100%',
            minHeight: 'fit-content',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            if (selectedModel?.id !== model.id) {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.borderColor = highlightColor;
            }
          }}
          onMouseLeave={(e) => {
            if (selectedModel?.id !== model.id) {
              e.currentTarget.style.background = 'var(--bg-secondary)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }
          }}
          title={model.name}
          aria-label={`Select model ${model.name}`}
        >
          <div style={{
            fontWeight: 500,
            fontSize: variant === 'compact' ? '0.75rem' : '0.875rem',
            marginBottom: model.size_bytes ? '0.25rem' : '0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--text-primary)',
          }}>
            {selectedModel?.id === model.id && (
              <span style={{ color: highlightColor, fontSize: '0.875rem', fontWeight: 600 }}>✓</span>
            )}
            <span style={{
              fontFamily: 'monospace',
              fontSize: variant === 'compact' ? '0.75rem' : '0.875rem',
              color: 'var(--text-primary)',
            }}>
              {formatModelName(model.name)}
            </span>
          </div>
          {model.size_bytes && (
            <div style={{
              fontSize: variant === 'compact' ? '0.7rem' : '0.75rem',
              color: 'var(--text-secondary)',
            }}>
              {(model.size_bytes / (1024 ** 3)).toFixed(1)} GB
            </div>
          )}
        </button>
      ))}
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={isLoading}
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            fontSize: '0.875rem',
            background: isLoading ? 'var(--bg-tertiary)' : 'var(--primary-gradient)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {isLoading ? '🔄 Refreshing...' : '🔄 Refresh Models'}
        </button>
      )}
    </div>
  );
}
