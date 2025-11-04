import { ReactNode } from 'react';
import { ModelSelector } from './ModelSelector';
import { LocalModel } from '../../services/api';

interface ModelSelectorSidebarProps {
  open: boolean;
  onClose: () => void;
  models: LocalModel[];
  selectedModel: LocalModel | null;
  onSelect: (model: LocalModel) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  formatModelName?: (name: string) => string;
  highlightColor?: string;
  title?: string;
}

/**
 * Reusable model selector sidebar component
 */
export function ModelSelectorSidebar({
  open,
  onClose,
  models,
  selectedModel,
  onSelect,
  onRefresh,
  isLoading = false,
  formatModelName = (name) => name,
  highlightColor = 'var(--primary-color)',
  title = 'Models',
}: ModelSelectorSidebarProps) {
  if (!open) return null;

  return (
    <div className="glass slide-in-left" style={{
      display: 'flex',
      flexDirection: 'column',
      borderRadius: 'var(--radius-xl)',
      padding: '1.5rem',
      boxShadow: 'var(--shadow-lg)',
      overflowY: 'auto',
      maxHeight: '100%',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>
          {title} ({models.length})
        </h3>
        <button
          onClick={onClose}
          style={{
            padding: '0.5rem',
            background: 'var(--bg-tertiary)',
            border: 'none',
            cursor: 'pointer',
            borderRadius: 'var(--radius-sm)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--error-bg)';
            e.currentTarget.style.color = 'var(--error)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-tertiary)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          title="Hide model list"
          aria-label="Close model selector"
        >
          ✕
        </button>
      </div>

      <ModelSelector
        models={models}
        selectedModel={selectedModel}
        onSelect={onSelect}
        onRefresh={onRefresh}
        isLoading={isLoading}
        formatModelName={formatModelName}
        highlightColor={highlightColor}
      />
    </div>
  );
}
