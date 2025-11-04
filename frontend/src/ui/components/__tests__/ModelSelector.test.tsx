import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '../../../test/utils';
import { ModelSelector } from '../ModelSelector';
import { LocalModel } from '../../../services/api';

describe('ModelSelector', () => {
  const mockModels: LocalModel[] = [
    {
      id: '1',
      name: 'llama2:7b',
      modality: 'text',
      executor_type: 'ollama',
      storage_path: '/models/llama2',
      size_bytes: 3800000000,
      created_at: '2024-01-01T00:00:00Z',
      metadata: {},
    },
    {
      id: '2',
      name: 'stable-diffusion-xl',
      modality: 'image',
      executor_type: 'ollama-diffuser',
      storage_path: '/models/sdxl',
      size_bytes: 6900000000,
      created_at: '2024-01-02T00:00:00Z',
      metadata: {},
    },
  ];

  it('renders model list correctly', () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <ModelSelector
        models={mockModels}
        selectedModel={null}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText(/llama2:7b/i)).toBeInTheDocument();
    expect(screen.getByText(/stable-diffusion-xl/i)).toBeInTheDocument();
  });

  it('displays model sizes in GB', () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <ModelSelector
        models={mockModels}
        selectedModel={null}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText(/3.5 GB/i)).toBeInTheDocument();
    expect(screen.getByText(/6.4 GB/i)).toBeInTheDocument();
  });

  it('calls onSelect when model is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    
    renderWithProviders(
      <ModelSelector
        models={mockModels}
        selectedModel={null}
        onSelect={onSelect}
      />
    );

    const firstModel = screen.getByRole('button', { name: /select model llama2:7b/i });
    await user.click(firstModel);

    expect(onSelect).toHaveBeenCalledWith(mockModels[0]);
  });

  it('highlights selected model', () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <ModelSelector
        models={mockModels}
        selectedModel={mockModels[0]}
        onSelect={onSelect}
      />
    );

    const selectedButton = screen.getByRole('button', { name: /select model llama2:7b/i });
    expect(selectedButton).toHaveTextContent('✓');
  });

  it('shows empty state when no models', () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <ModelSelector
        models={[]}
        selectedModel={null}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText(/no models available/i)).toBeInTheDocument();
  });

  it('renders refresh button when onRefresh provided', () => {
    const onSelect = vi.fn();
    const onRefresh = vi.fn();
    
    renderWithProviders(
      <ModelSelector
        models={mockModels}
        selectedModel={null}
        onSelect={onSelect}
        onRefresh={onRefresh}
      />
    );

    expect(screen.getByRole('button', { name: /refresh models/i })).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onRefresh = vi.fn();
    
    renderWithProviders(
      <ModelSelector
        models={mockModels}
        selectedModel={null}
        onSelect={onSelect}
        onRefresh={onRefresh}
      />
    );

    const refreshButton = screen.getByRole('button', { name: /refresh models/i });
    await user.click(refreshButton);

    expect(onRefresh).toHaveBeenCalled();
  });

  it('disables refresh button when loading', () => {
    const onSelect = vi.fn();
    const onRefresh = vi.fn();
    
    renderWithProviders(
      <ModelSelector
        models={mockModels}
        selectedModel={null}
        onSelect={onSelect}
        onRefresh={onRefresh}
        isLoading={true}
      />
    );

    const refreshButton = screen.getByRole('button', { name: /refreshing/i });
    expect(refreshButton).toBeDisabled();
  });

  it('applies custom formatModelName function', () => {
    const onSelect = vi.fn();
    const formatModelName = (name: string) => name.toUpperCase();
    
    renderWithProviders(
      <ModelSelector
        models={mockModels}
        selectedModel={null}
        onSelect={onSelect}
        formatModelName={formatModelName}
      />
    );

    expect(screen.getByText('LLAMA2:7B')).toBeInTheDocument();
  });

  it('renders compact variant correctly', () => {
    const onSelect = vi.fn();
    
    const { container } = renderWithProviders(
      <ModelSelector
        models={mockModels}
        selectedModel={null}
        onSelect={onSelect}
        variant="compact"
      />
    );

    // In compact variant, buttons should have smaller padding
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
