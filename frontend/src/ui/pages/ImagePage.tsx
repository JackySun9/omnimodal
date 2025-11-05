import { FormEvent, useEffect, useState, useRef } from 'react';
import { ExecutionResponse, LocalModel } from '../../services/api';
import { useImageModels, useExecutorStatus, useRefreshModels } from '../../hooks/useModels';
import { useModelInitialization } from '../../hooks/useModelInitialization';
import { useJobExecutionWithCallback } from '../../hooks/useJobExecution';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { LoadingSpinner, ModelSelectorSidebar, ErrorDisplay, SuccessMessage } from '../components';

interface GeneratedImage {
  id: string;
  data: string;
  prompt: string;
  negativePrompt: string;
  parameters: Record<string, unknown>;
  timestamp: Date;
}

// Format model display name (e.g., "sd35-medium:latest" -> "SD35 Medium")
function formatModelName(name: string): string {
  if (!name) return 'Unknown Model';
  
  try {
    const [modelName, tag] = name.split(':');
    const formatted = modelName
      .split(/[-_]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    
    if (tag && tag !== 'latest') {
      return `${formatted} (${tag})`;
    }
    
    return formatted;
  } catch (error) {
    return name;
  }
}

export function ImagePage() {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('low quality, bad anatomy, worst quality');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [steps, setSteps] = useState(28);
  const [cfgScale, setCfgScale] = useState(3.5);
  const [numImages, setNumImages] = useState(1);
  const [seed, setSeed] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Models using React Query
  const { models: allImageModels, isLoading: modelsLoading, error: modelsError } = useImageModels();
  // Filter to only show OllamaDiffuser models (not HuggingFace models which won't work)
  const models = allImageModels.filter(m => {
    const metadata = m.model_metadata as Record<string, any> || {};
    return metadata.source === 'ollamadiffuser';
  });
  const { data: executorStatus, isLoading: statusLoading, error: statusError } = useExecutorStatus('ollama-diffuser');
  const refreshModels = useRefreshModels();
  const [selectedModel, setSelectedModel] = useState<LocalModel | null>(null);
  const [showModelSelector, setShowModelSelector] = useState(false);
  
  // Model initialization hook
  const { initializing, initMessage, error: initError, initialize } = useModelInitialization(
    selectedModel,
    { executorName: 'ollama-diffuser', autoStart: true }
  );
  
  // Hooks
  const { handleError, handleSuccess, handleLoading } = useErrorHandler('Image Generation');
  const executeJobMutation = useJobExecutionWithCallback('ollama-diffuser', {
    onError: (err) => {
      handleError(err);
    },
  });
  
  // LoRA support
  const [selectedLoRA, setSelectedLoRA] = useState<string>('');
  const [loraScale, setLoraScale] = useState(0.8);
  const [availableLoRAs] = useState<Array<{ name: string; size: string }>>([
    { name: 'ghibli', size: '164 MB' },
    { name: 'sd35-turbo', size: '50 MB' },
    { name: 'tensorart_stable-diffusion-3.5-medium-turbo', size: '112 MB' },
    { name: 'OmniConsistency', size: '285 MB' },
  ]);
  
  // ControlNet support
  const [useControlNet, setUseControlNet] = useState(false);
  const [controlImage, setControlImage] = useState<File | null>(null);
  const [controlImagePreview, setControlImagePreview] = useState<string>('');
  const [controlNetScale, setControlNetScale] = useState(1.0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesEndRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Auto-select flux-schnell as default, or first available model (but don't auto-initialize)
  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      // Prioritize flux-schnell as the default model (handles both flux-schnell and flux.1-schnell)
      const fluxSchnell = models.find(m => {
        const name = m.name.toLowerCase();
        return name.includes('schnell') && name.includes('flux');
      });
      
      if (fluxSchnell) {
        setSelectedModel(fluxSchnell);
      } else {
        // Find first model that's not a helper model (not lora, vae, text_encoder, etc.)
        const mainModel = models.find(m => {
          const name = m.name.toLowerCase();
          return !name.includes('lora') && 
                 !name.includes('vae') && 
                 !name.includes('text_encoder') &&
                 !name.includes('backup') &&
                 !name.includes('controlnet') &&
                 !name.includes('annotator');
        });
        setSelectedModel(mainModel || models[0]);
      }
    }
  }, [models, selectedModel]);

  useEffect(() => {
    if (generatedImages.length > 0) {
      imagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [generatedImages]);

  // Handle errors
  useEffect(() => {
    if (modelsError) {
      handleError(modelsError);
      setError(handleError(modelsError));
    }
    if (statusError) {
      handleError(statusError);
    }
    if (initError) {
      setError(initError);
    }
  }, [modelsError, statusError, initError, handleError]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        const errorMsg = 'Please select a valid image file';
        setError(errorMsg);
        handleError(errorMsg);
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        const errorMsg = 'Image file is too large. Maximum size is 10MB.';
        setError(errorMsg);
        handleError(errorMsg);
        return;
      }
      
      setControlImage(file);
      setError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setControlImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearControlImage = () => {
    setControlImage(null);
    setControlImagePreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim() || loading || !selectedModel) return;

    setLoading(true);
    setError(null);
    const loadingToast = handleLoading('Generating image...');
    
    try {
      // Validate dimensions
      if (width < 256 || width > 2048 || height < 256 || height > 2048) {
        const errorMsg = 'Image dimensions must be between 256 and 2048 pixels';
        setError(errorMsg);
        handleError(errorMsg);
        setLoading(false);
        return;
      }

      const parameters: any = {
        model: selectedModel.name,
        prompt: prompt.trim(),
        negative_prompt: negativePrompt.trim(),
        width,
        height,
        steps,
        cfg_scale: cfgScale,
        num_images: numImages,
        seed: seed >= 0 ? seed : undefined,
      };

      if (selectedLoRA) {
        parameters.lora = selectedLoRA;
        parameters.lora_scale = loraScale;
      }

      if (useControlNet && controlImage) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            if (reader.result) {
              resolve(reader.result as string);
            } else {
              reject(new Error('Failed to read image'));
            }
          };
          reader.onerror = () => reject(new Error('Failed to read image'));
          reader.readAsDataURL(controlImage);
        });
        const base64Image = await base64Promise;
        parameters.control_image = base64Image;
        parameters.controlnet_conditioning_scale = controlNetScale;
      }

      const response: ExecutionResponse = await executeJobMutation.mutateAsync({
        model_id: selectedModel.id,
        parameters,
      });

      if (response.status === 'completed' && response.result?.images) {
        const images = response.result.images as string[];
        const newImages: GeneratedImage[] = images.map((img, idx) => ({
          id: `${Date.now()}-${idx}`,
          data: img,
          prompt: prompt.trim(),
          negativePrompt: negativePrompt.trim(),
          parameters: { width, height, steps, cfgScale, seed, selectedLoRA },
          timestamp: new Date(),
        }));
        setGeneratedImages((prev) => [...prev, ...newImages]);
        handleSuccess(`Generated ${images.length} image${images.length > 1 ? 's' : ''} successfully!`);
        // Clear prompt after successful generation
        setPrompt('');
        promptRef.current?.focus();
      } else if (response.status === 'error') {
        const errorMsg = response.result?.error as string || 'Unknown error occurred';
        setError(`Generation failed: ${errorMsg}`);
        handleError(errorMsg);
      }
    } catch (error) {
      const errorMsg = handleError(error);
      setError(`Generation failed: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const clearImages = () => {
    if (confirm('Are you sure you want to clear all generated images?')) {
      setGeneratedImages([]);
    }
  };

  const deleteImage = (id: string) => {
    setGeneratedImages((prev) => prev.filter(img => img.id !== id));
  };

  const switchModel = (model: LocalModel) => {
    setSelectedModel(model);
    setShowModelSelector(false);
    setError(null);
    // Don't auto-initialize - let user click "Load Model" button explicitly
  };

  const downloadImage = (image: GeneratedImage) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${image.data}`;
    link.download = `generated-${image.id}.png`;
    link.click();
  };

  if (statusLoading || modelsLoading) {
    return (
      <div className="fade-in" style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="loading shimmer" style={{ width: '3rem', height: '3rem', margin: '0 auto', borderRadius: '50%' }}></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading image generation...</p>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="fade-in" style={{ padding: '2rem' }}>
        <div style={{ 
          padding: '2rem', 
          backgroundColor: 'var(--warning-bg)', 
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--warning)',
          textAlign: 'center',
        }}>
          <h3 style={{ fontSize: '3rem', marginBottom: '1rem' }}>??</h3>
          <h3>No Image Models Found</h3>
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>Please add some image generation models to start creating.</p>
          <button 
            onClick={() => window.location.href = '/models'} 
            style={{ 
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              background: 'var(--primary-gradient)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            Browse Models
          </button>
        </div>
      </div>
    );
  }

  if (executorStatus && !executorStatus.is_running) {
    return (
      <div className="fade-in" style={{ padding: '2rem' }}>
        <div style={{ 
          padding: '2rem', 
          backgroundColor: 'var(--warning-bg)', 
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--warning)',
        }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            ?? OllamaDiffuser Not Running
          </h3>
          <p style={{ marginBottom: '1rem' }}>Please start OllamaDiffuser to use image generation.</p>
          {initMessage && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '0.75rem', 
              backgroundColor: 'var(--info-bg)', 
              borderRadius: 'var(--radius-md)', 
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}>
              {initMessage}
            </div>
          )}
          {error && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '0.75rem', 
              backgroundColor: 'var(--error-bg)', 
              borderRadius: 'var(--radius-md)', 
              fontSize: '0.875rem',
              color: 'var(--error)',
              marginBottom: '1rem',
            }}>
              {error}
            </div>
          )}
          <button 
            onClick={initialize} 
            disabled={initializing} 
            style={{ 
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              background: initializing ? 'var(--bg-tertiary)' : 'var(--primary-gradient)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {initializing ? '? Starting...' : '?? Start Service'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="scale-in" style={{ display: 'grid', gridTemplateColumns: showModelSelector ? '350px 1fr' : '1fr', height: '100%', gap: '1rem', padding: '1.5rem', overflow: 'hidden', transition: 'grid-template-columns 0.3s ease' }}>
      {/* Model Selector Sidebar */}
      {showModelSelector && (
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
              Models ({models.length})
            </h3>
            <button
              onClick={() => setShowModelSelector(false)}
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
              ?
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto' }}>
            {models.map((model) => {
              const isSelected = selectedModel?.id === model.id;
              const isLoaded = isSelected && executorStatus?.detail?.model_loaded;
              
              return (
                <button
                  key={model.id}
                  onClick={() => switchModel(model)}
                  disabled={initializing}
                  style={{
                    padding: '0.75rem 1rem',
                    textAlign: 'left',
                    background: isSelected 
                      ? isLoaded
                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.08))'
                        : 'linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(236, 72, 153, 0.08))'
                      : 'var(--bg-secondary)',
                    border: isSelected 
                      ? isLoaded
                        ? '2px solid var(--success)'
                        : '2px solid var(--secondary-color)'
                      : '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    cursor: initializing ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected 
                      ? isLoaded
                        ? '0 2px 8px rgba(16, 185, 129, 0.2)'
                        : '0 2px 8px rgba(236, 72, 153, 0.2)'
                      : '0 1px 2px rgba(0, 0, 0, 0.05)',
                    width: '100%',
                    minHeight: 'fit-content',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    opacity: initializing ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && !initializing) {
                      e.currentTarget.style.background = 'var(--bg-tertiary)';
                      e.currentTarget.style.borderColor = 'var(--secondary-color)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'var(--bg-secondary)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                    }
                  }}
                  title={isLoaded ? `${model.name} (Loaded in OllamaDiffuser)` : model.name}
                  aria-label={`Select model ${model.name}`}
                >
                  <div style={{ 
                    fontWeight: 500, 
                    fontSize: '0.875rem',
                    marginBottom: model.size_bytes ? '0.25rem' : '0', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: 'var(--text-primary)',
                  }}>
                    {isLoaded ? (
                      <span style={{ color: 'var(--success)', fontSize: '0.875rem', fontWeight: 600 }}>?</span>
                    ) : isSelected ? (
                      <span style={{ color: 'var(--secondary-color)', fontSize: '0.875rem', fontWeight: 600 }}>?</span>
                    ) : null}
                    <span style={{ 
                      fontFamily: 'monospace', 
                      fontSize: '0.875rem',
                      color: 'var(--text-primary)',
                    }}>
                      {model.name}
                    </span>
                  </div>
                  {model.size_bytes && (
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--text-secondary)',
                    }}>
                      {(model.size_bytes / (1024**3)).toFixed(1)} GB
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => refreshModels()}
            disabled={modelsLoading}
            style={{
              marginTop: '1rem',
              padding: '0.75rem',
              fontSize: '0.875rem',
              background: modelsLoading ? 'var(--bg-tertiary)' : 'var(--secondary-gradient)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {modelsLoading ? '? Refreshing...' : '?? Refresh Models'}
          </button>
        </div>
      )}

      {/* Main Image Generation Area */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem', minWidth: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div className="glass" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '1.25rem',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-md)',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
            {!showModelSelector && (
              <button
                onClick={() => setShowModelSelector(true)}
                style={{
                  padding: '0.75rem',
                  background: 'var(--secondary-gradient)',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-md)',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  boxShadow: 'var(--shadow-md)',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
                title="Show model list"
                aria-label="Open model selector"
              >
                Models
              </button>
            )}
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 className="gradient-text" style={{ margin: 0, fontSize: '1.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                ??? Image Generation
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                <span className={executorStatus.healthy ? 'tag tag-success' : 'tag tag-error'} style={{ fontSize: '0.75rem' }}>
                  {executorStatus.healthy ? '? Online' : '? Offline'}
                </span>
                {selectedModel && (
                  <span className="tag tag-info" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    ?? {formatModelName(selectedModel.name)}
                  </span>
                )}
                {executorStatus?.detail?.model_loaded && (
                  <span className="tag tag-success" style={{ fontSize: '0.75rem' }}>
                    ? Loaded
                  </span>
                )}
                {selectedLoRA && <span className="tag tag-primary" style={{ fontSize: '0.75rem' }}>? {selectedLoRA}</span>}
                {useControlNet && controlImage && <span className="tag tag-warning" style={{ fontSize: '0.75rem' }}>?? ControlNet</span>}
                {generatedImages.length > 0 && (
                  <span className="tag" style={{ fontSize: '0.75rem' }}>
                    {generatedImages.length} image{generatedImages.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {initMessage && !statusLoading && !initializing && (
                <div style={{ 
                  marginTop: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  background: initMessage.includes('Error') || initMessage.includes('Warning') || initMessage.includes('failed')
                    ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05))'
                    : 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))',
                  border: `1px solid ${initMessage.includes('Error') || initMessage.includes('Warning') || initMessage.includes('failed') ? 'var(--warning)' : 'var(--success)'}`,
                  fontSize: '0.75rem',
                  color: initMessage.includes('Error') || initMessage.includes('Warning') || initMessage.includes('failed') ? 'var(--warning)' : 'var(--success)',
                }}>
                  {initMessage}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {selectedModel && (
              <button
                onClick={() => initialize()}
                disabled={initializing || !executorStatus?.is_running}
                style={{
                  background: initializing 
                    ? 'var(--bg-tertiary)' 
                    : executorStatus?.detail?.model_loaded 
                      ? 'var(--success-gradient)' 
                      : 'var(--primary-gradient)',
                  boxShadow: 'var(--shadow-md)',
                  padding: '0.75rem 1.25rem',
                  fontSize: '0.875rem',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  cursor: initializing || !executorStatus?.is_running ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!initializing && executorStatus?.is_running) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                }}
                title={executorStatus?.detail?.model_loaded ? 'Reload model' : 'Load model into OllamaDiffuser'}
              >
                {initializing ? '? Loading...' : executorStatus?.detail?.model_loaded ? '?? Reload Model' : '?? Load Model'}
              </button>
            )}
            {generatedImages.length > 0 && (
              <button 
                type="button" 
                onClick={clearImages} 
                disabled={loading}
                style={{ 
                  background: 'var(--error-gradient)',
                  boxShadow: 'var(--shadow-md)',
                  padding: '0.75rem 1.25rem',
                  fontSize: '0.875rem',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                }}
                title="Clear all generated images"
              >
                Clear ({generatedImages.length})
              </button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
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
              <span style={{ fontSize: '1.25rem' }}>??</span>
              <span style={{ fontSize: '0.875rem' }}>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              style={{
                padding: '0.25rem 0.5rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--error)',
                fontSize: '1.25rem',
                lineHeight: 1,
              }}
              aria-label="Dismiss error"
            >
              ?
            </button>
          </div>
        )}

        {/* Configuration Panel */}
        <details className="glass" style={{ 
          padding: '1rem', 
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-md)',
        }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', userSelect: 'none' }}>
            ?? Settings
          </summary>
          <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <label style={{ fontSize: '0.875rem' }}>
                Width: {width}px
                <input
                  type="range"
                  min="256"
                  max="2048"
                  step="64"
                  value={width}
                  onChange={(e) => setWidth(parseInt(e.target.value))}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                  disabled={loading}
                />
                <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  {width < 512 ? 'Fast' : width < 1024 ? 'Balanced' : 'High quality'}
                </small>
              </label>

              <label style={{ fontSize: '0.875rem' }}>
                Height: {height}px
                <input
                  type="range"
                  min="256"
                  max="2048"
                  step="64"
                  value={height}
                  onChange={(e) => setHeight(parseInt(e.target.value))}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                  disabled={loading}
                />
                <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  {height < 512 ? 'Fast' : height < 1024 ? 'Balanced' : 'High quality'}
                </small>
              </label>

              <label style={{ fontSize: '0.875rem' }}>
                Steps: {steps}
                <input
                  type="range"
                  min="4"
                  max="50"
                  step="2"
                  value={steps}
                  onChange={(e) => setSteps(parseInt(e.target.value))}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                  disabled={loading}
                />
                <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  {steps < 10 ? 'Fast (Turbo)' : steps < 25 ? 'Balanced' : 'High quality'}
                </small>
              </label>

              <label style={{ fontSize: '0.875rem' }}>
                CFG Scale: {cfgScale.toFixed(1)}
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="0.5"
                  value={cfgScale}
                  onChange={(e) => setCfgScale(parseFloat(e.target.value))}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                  disabled={loading}
                />
                <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  {cfgScale === 0 ? 'Schnell mode' : cfgScale < 5 ? 'Creative' : 'Precise'}
                </small>
              </label>

              <label style={{ fontSize: '0.875rem' }}>
                Number of Images: {numImages}
                <input
                  type="range"
                  min="1"
                  max="4"
                  step="1"
                  value={numImages}
                  onChange={(e) => setNumImages(parseInt(e.target.value))}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                  disabled={loading}
                />
              </label>

              <label style={{ fontSize: '0.875rem' }}>
                Seed: {seed === -1 ? 'Random' : seed}
                <input
                  type="number"
                  min="-1"
                  max="2147483647"
                  value={seed}
                  onChange={(e) => setSeed(parseInt(e.target.value) || -1)}
                  style={{ width: '100%', marginTop: '0.25rem' }}
                  disabled={loading}
                  placeholder="-1 for random"
                />
                <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  Use -1 for random or specific number for reproducibility
                </small>
              </label>
            </div>

            {/* LoRA Section */}
            <details style={{ marginTop: '0.5rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, userSelect: 'none', padding: '0.5rem 0' }}>? LoRA (Style Transfer)</summary>
              <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                <label style={{ fontSize: '0.875rem' }}>
                  <strong>Select LoRA:</strong>
                  <select
                    value={selectedLoRA}
                    onChange={(e) => setSelectedLoRA(e.target.value)}
                    style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem' }}
                    disabled={loading}
                  >
                    <option value="">None</option>
                    {availableLoRAs.map((lora) => (
                      <option key={lora.name} value={lora.name}>
                        {lora.name} ({lora.size})
                      </option>
                    ))}
                  </select>
                </label>

                {selectedLoRA && (
                  <label style={{ fontSize: '0.875rem' }}>
                    <strong>LoRA Strength: {loraScale.toFixed(1)}</strong>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={loraScale}
                      onChange={(e) => setLoraScale(parseFloat(e.target.value))}
                      style={{ width: '100%', marginTop: '0.25rem' }}
                      disabled={loading}
                    />
                    <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                      {loraScale < 0.3 ? 'Subtle effect' : loraScale < 0.7 ? 'Balanced' : 'Strong effect'}
                    </small>
                  </label>
                )}
              </div>
            </details>

            {/* ControlNet Section */}
            <details style={{ marginTop: '0.5rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, userSelect: 'none', padding: '0.5rem 0' }}>?? ControlNet (Guided Generation)</summary>
              <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={useControlNet}
                    onChange={(e) => {
                      setUseControlNet(e.target.checked);
                      if (!e.target.checked) {
                        clearControlImage();
                      }
                    }}
                    disabled={loading}
                  />
                  <span>Enable ControlNet</span>
                </label>

                {useControlNet && (
                  <>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <strong style={{ fontSize: '0.875rem' }}>Control Image:</strong>
                        {controlImage && (
                          <button
                            type="button"
                            onClick={clearControlImage}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              background: 'var(--error-bg)',
                              color: 'var(--error)',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                            }}
                            title="Remove control image"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        style={{ 
                          display: 'block', 
                          width: '100%',
                          padding: '0.5rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-color)',
                        }}
                        disabled={loading}
                      />
                      {controlImagePreview && (
                        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
                          <img
                            src={controlImagePreview}
                            alt="Control preview"
                            style={{ 
                              maxWidth: '200px', 
                              maxHeight: '200px', 
                              borderRadius: 'var(--radius-md)',
                              border: '2px solid var(--info)',
                              objectFit: 'contain',
                            }}
                          />
                        </div>
                      )}
                      <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        Upload an image for edge/depth/pose guidance (max 10MB)
                      </small>
                    </div>

                    <label style={{ fontSize: '0.875rem' }}>
                      <strong>Conditioning Scale: {controlNetScale.toFixed(1)}</strong>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={controlNetScale}
                        onChange={(e) => setControlNetScale(parseFloat(e.target.value))}
                        style={{ width: '100%', marginTop: '0.25rem' }}
                        disabled={loading}
                      />
                      <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        {controlNetScale < 0.5 ? 'Loose guidance' : controlNetScale < 1.2 ? 'Balanced' : 'Strict guidance'}
                      </small>
                    </label>
                  </>
                )}
              </div>
            </details>
          </div>
        </details>

        {/* Generated Images Gallery */}
        <div
          className="glass"
          style={{
            flex: '1 1 auto',
            overflowY: 'auto',
            overflowX: 'hidden',
            borderRadius: 'var(--radius-xl)',
            padding: '1.5rem',
            boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.05)',
            minHeight: 0,
            maxHeight: '100%',
          }}
        >
          {loading && (
            <LoadingSpinner message={`Generating ${numImages} image${numImages > 1 ? 's' : ''}...`} />
          )}
          
          {!loading && generatedImages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>??</div>
              <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>Start generating images</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                Using: <strong>{selectedModel ? formatModelName(selectedModel.name) : ''}</strong>
              </p>
              <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                Enter a prompt and click Generate to create your first image
              </p>
            </div>
          )}

          {!loading && generatedImages.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {generatedImages.map((img) => (
                <div 
                  key={img.id} 
                  className="card scale-in"
                  style={{ 
                    padding: '0',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'var(--transition-slow)',
                    position: 'relative',
                    border: '2px solid var(--border-color)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    <img
                      src={`data:image/png;base64,${img.data}`}
                      alt={`Generated ${img.id}`}
                      style={{ width: '100%', height: 'auto', display: 'block' }}
                      onClick={() => {
                        const win = window.open();
                        if (win) {
                          win.document.write(`
                            <html>
                              <head><title>Generated Image</title></head>
                              <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#1a1a1a;">
                                <img src="data:image/png;base64,${img.data}" style="max-width:100%;max-height:100vh;object-fit:contain;"/>
                              </body>
                            </html>
                          `);
                        }
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '0.5rem',
                      right: '0.5rem',
                      display: 'flex',
                      gap: '0.25rem',
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadImage(img);
                        }}
                        style={{
                          padding: '0.5rem',
                          background: 'rgba(0, 0, 0, 0.7)',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          color: 'white',
                          fontSize: '1rem',
                          backdropFilter: 'blur(4px)',
                        }}
                        title="Download image"
                        aria-label="Download image"
                      >
                        ??
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteImage(img.id);
                        }}
                        style={{
                          padding: '0.5rem',
                          background: 'rgba(239, 68, 68, 0.8)',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          color: 'white',
                          fontSize: '1rem',
                          backdropFilter: 'blur(4px)',
                        }}
                        title="Delete image"
                        aria-label="Delete image"
                      >
                        ???
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                      {img.prompt}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{img.timestamp.toLocaleTimeString()}</span>
                      <span style={{ cursor: 'pointer' }} onClick={(e) => {
                        e.stopPropagation();
                        const win = window.open();
                        if (win) {
                          win.document.write(`
                            <html>
                              <head><title>Generated Image</title></head>
                              <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#1a1a1a;">
                                <img src="data:image/png;base64,${img.data}" style="max-width:100%;max-height:100vh;object-fit:contain;"/>
                              </body>
                            </html>
                          `);
                        }
                      }}>?? Enlarge</span>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={imagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to generate... (e.g., A serene mountain landscape at sunset, cinematic lighting, highly detailed)"
              disabled={loading}
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmit(e as any);
                }
              }}
              style={{ 
                flex: 1,
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '2px solid var(--border-color)',
                resize: 'vertical',
                fontSize: '0.9375rem',
                fontFamily: 'inherit',
              }}
            />
            <textarea
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="Negative prompt (what to avoid)..."
              disabled={loading}
              rows={1}
              style={{ 
                flex: 1,
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '2px solid var(--border-color)',
                resize: 'vertical',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <button 
            type="submit" 
            disabled={loading || !prompt.trim() || !selectedModel}
            style={{ 
              height: 'fit-content',
              padding: '1rem 1.5rem',
              fontSize: '0.9375rem',
              background: loading || !prompt.trim() || !selectedModel ? 'var(--bg-tertiary)' : 'var(--secondary-gradient)',
              boxShadow: loading || !prompt.trim() || !selectedModel ? 'none' : 'var(--shadow-glow)',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
              cursor: loading || !prompt.trim() || !selectedModel ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!loading && prompt.trim() && selectedModel) {
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
            }}
          >
            {loading ? '? Generating...' : '? Generate'}
          </button>
        </form>
      </div>
    </section>
  );
}
