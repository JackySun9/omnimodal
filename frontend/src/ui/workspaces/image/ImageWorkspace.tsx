import { FormEvent, useEffect, useState, useRef } from 'react';
import { executeJob, ExecutionResponse, getExecutorStatus, ExecutorStatus, fetchLocalModels, startExecutor, loadModelIntoExecutor, getModelInfo } from '../../../services/api';

interface ImageWorkspaceProps {
  modelId: string;
}

interface LoRA {
  name: string;
  size: string;
}

export function ImageWorkspace({ modelId }: ImageWorkspaceProps) {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('low quality, bad anatomy, worst quality');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [steps, setSteps] = useState(28);
  const [cfgScale, setCfgScale] = useState(3.5);
  const [numImages, setNumImages] = useState(1);
  const [seed, setSeed] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [executorStatus, setExecutorStatus] = useState<ExecutorStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [modelName, setModelName] = useState<string>('');
  const [initializing, setInitializing] = useState(false);
  const [initMessage, setInitMessage] = useState<string>('');
  
  // LoRA support
  const [selectedLoRA, setSelectedLoRA] = useState<string>('');
  const [loraScale, setLoraScale] = useState(0.8);
  const [availableLoRAs] = useState<LoRA[]>([
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

  useEffect(() => {
    const initializeWorkspace = async () => {
      setInitializing(true);
      setInitMessage('Loading model information...');
      
      try {
        // Step 1: Get model name
        const models = await fetchLocalModels();
        const model = models.find(m => m.id === modelId);
        if (!model) {
          throw new Error('Model not found');
        }
        setModelName(model.name);
        
        // Step 2: Check if ollama-diffuser is running
        setInitMessage('Checking OllamaDiffuser status...');
        let status;
        try {
          status = await getExecutorStatus('ollama-diffuser');
        } catch (error) {
          // Service not responding, try to start it
          console.log('OllamaDiffuser not responding, attempting to start...');
          status = { is_running: false, healthy: false, name: 'ollama-diffuser', detail: {} };
        }
        
        // Step 3: Start service if not running
        if (!status.is_running) {
          setInitMessage('Starting OllamaDiffuser service...');
          try {
            const startResult = await startExecutor('ollama-diffuser');
            console.log('Start result:', startResult);
            
            // Wait for service to be ready
            setInitMessage('Waiting for service to initialize...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Try to get status again with retries
            let retries = 3;
            while (retries > 0) {
              try {
                status = await getExecutorStatus('ollama-diffuser');
                if (status.is_running) {
                  break;
                }
              } catch (e) {
                console.log(`Retry ${4 - retries}/3 - service not ready yet`);
              }
              await new Promise(resolve => setTimeout(resolve, 2000));
              retries--;
            }
            
            if (!status.is_running) {
              setInitMessage('Service started but not responding. Please check if ollamadiffuser is installed correctly.');
              setExecutorStatus(status);
              return;
            }
          } catch (error) {
            console.error('Failed to start OllamaDiffuser:', error);
            setInitMessage(`Failed to start service: ${(error as Error).message}. Please run 'ollamadiffuser serve --port 11435' manually.`);
            setExecutorStatus(status);
            return;
          }
        }
        
        setExecutorStatus(status);
        
        // Step 4: Load the model if service is running
        if (status.is_running) {
          setInitMessage(`Loading model: ${model.name}...`);
          try {
            await loadModelIntoExecutor('ollama-diffuser', model.name);
            setInitMessage('Model loaded successfully!');
            
            // Step 5: Get model defaults and apply them
            try {
              const modelInfo = await getModelInfo('ollama-diffuser', model.name);
              if (modelInfo.default_parameters) {
                const params = modelInfo.default_parameters;
                setWidth(params.width || 1024);
                setHeight(params.height || 1024);
                setSteps(params.steps || 28);
                setCfgScale(params.cfg_scale || 3.5);
                console.log('Applied model defaults:', params);
              }
            } catch (error) {
              console.log('Could not fetch model defaults, using standard values');
            }
            
            // Refresh status to show model is loaded
            try {
              status = await getExecutorStatus('ollama-diffuser');
              setExecutorStatus(status);
            } catch (e) {
              console.log('Could not refresh status');
            }
          } catch (error) {
            console.error('Failed to load model:', error);
            const errorMsg = (error as Error).message;
            
            // Show user-friendly error with actionable steps
            if (errorMsg.includes('corrupted') || errorMsg.includes('failed to load')) {
              setInitMessage(
                `⚠️ Model loading failed!\n\n` +
                `The model "${model.name}" may be corrupted or incomplete.\n\n` +
                `Quick fixes:\n` +
                `1. Re-download: ollamadiffuser pull ${model.name}\n` +
                `2. Try a different quantization (Q4-1, Q2K work well)\n` +
                `3. Check 'ollamadiffuser list' to verify model status\n\n` +
                `You can still try generating, but it may fail.`
              );
            } else {
              setInitMessage(`Warning: Could not load model. ${errorMsg}`);
            }
          }
        }
      } catch (error) {
        console.error('Initialization error:', error);
        setInitMessage(`Error: ${(error as Error).message}`);
      } finally {
        setStatusLoading(false);
        setInitializing(false);
        // Clear success message after 5 seconds
        setTimeout(() => {
          if (initMessage.includes('successfully')) {
            setInitMessage('');
          }
        }, 5000);
      }
    };
    
    void initializeWorkspace();
  }, [modelId]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setControlImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setControlImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim() || loading || !modelName) return;

    setLoading(true);
    try {
      const parameters: any = {
        model: modelName,
        prompt: prompt.trim(),
        negative_prompt: negativePrompt.trim(),
        width,
        height,
        steps,
        cfg_scale: cfgScale,
        num_images: numImages,
        seed: seed >= 0 ? seed : undefined, // Only send seed if >= 0
      };

      // Add LoRA if selected
      if (selectedLoRA) {
        parameters.lora = selectedLoRA;
        parameters.lora_scale = loraScale;
      }

      // Add ControlNet if enabled and image uploaded
      if (useControlNet && controlImage) {
        // Convert image to base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(controlImage);
        });
        const base64Image = await base64Promise;
        
        parameters.control_image = base64Image;
        parameters.controlnet_conditioning_scale = controlNetScale;
      }

      const response: ExecutionResponse = await executeJob('ollama-diffuser', {
        model_id: modelId,
        parameters,
      });

      if (response.status === 'completed' && response.result?.images) {
        setImages(response.result.images as string[]);
      } else if (response.status === 'error') {
        alert(`Error: ${response.result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`Error: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  if (statusLoading || initializing || !modelName) {
    return (
      <div className="fade-in" style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="loading shimmer" style={{ width: '3rem', height: '3rem', margin: '0 auto', borderRadius: '50%' }}></div>
        <p style={{ marginTop: '1.5rem', color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.125rem' }}>
          {initMessage || 'Initializing workspace...'}
        </p>
        <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          This may take a moment
        </p>
      </div>
    );
  }

  const handleManualStart = async () => {
    setInitializing(true);
    setInitMessage('Attempting to start OllamaDiffuser service...');
    
    try {
      await startExecutor('ollama-diffuser');
      setInitMessage('Service started! Waiting for it to be ready...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check status with retries
      let retries = 3;
      let status;
      while (retries > 0) {
        try {
          status = await getExecutorStatus('ollama-diffuser');
          if (status.is_running) {
            setExecutorStatus(status);
            setInitMessage('Service is ready!');
            setTimeout(() => setInitMessage(''), 3000);
            break;
          }
        } catch (e) {
          console.log(`Retry ${4 - retries}/3`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        retries--;
      }
      
      if (!status?.is_running) {
        setInitMessage('Service started but not responding. Please check the console.');
      }
    } catch (error) {
      setInitMessage(`Failed to start: ${(error as Error).message}`);
    } finally {
      setInitializing(false);
    }
  };

  const handleCheckStatus = async () => {
    setStatusLoading(true);
    setInitMessage('Checking service status...');
    try {
      const status = await getExecutorStatus('ollama-diffuser');
      setExecutorStatus(status);
      if (status.is_running) {
        setInitMessage('Service is running! Loading workspace...');
        // Trigger a re-render which will move past the error screen
        setTimeout(() => {
          setStatusLoading(false);
          setInitMessage('');
        }, 1000);
      } else {
        setInitMessage('Service is not running.');
        setStatusLoading(false);
      }
    } catch (error) {
      setInitMessage(`Cannot connect: ${(error as Error).message}`);
      setStatusLoading(false);
    }
  };

  if (!executorStatus?.is_running) {
    return (
      <div className="fade-in" style={{ padding: '2rem' }}>
        <div style={{ 
          padding: '2rem', 
          backgroundColor: 'var(--warning-bg)', 
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--warning)',
        }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            ⚠️ OllamaDiffuser Not Running
          </h3>
          <p style={{ marginBottom: '1rem' }}>
            OllamaDiffuser is a separate service for image generation that needs to be installed and started.
          </p>
          
          {executorStatus?.detail?.reason && (
            <div style={{ 
              padding: '0.75rem', 
              backgroundColor: 'var(--bg-tertiary)', 
              borderRadius: 'var(--radius-md)',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
            }}>
              <strong>Status:</strong> {executorStatus.detail.reason as string}
            </div>
          )}
          
          {initMessage && (
            <div style={{ 
              padding: '0.75rem', 
              backgroundColor: 'var(--info-bg)', 
              borderRadius: 'var(--radius-md)',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              color: 'var(--info)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              {initializing && <div className="loading" style={{ width: '1rem', height: '1rem' }}></div>}
              <span>{initMessage}</span>
            </div>
          )}

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button 
              onClick={handleCheckStatus}
              disabled={initializing || statusLoading}
              style={{
                background: 'var(--primary-gradient)',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              {statusLoading ? '🔄 Checking...' : '🔄 Check Status'}
            </button>
            <button 
              onClick={handleManualStart}
              disabled={initializing || statusLoading}
              style={{
                background: 'var(--success-gradient)',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              {initializing ? '🚀 Starting...' : '🚀 Start Service'}
            </button>
            <button 
              type="button"
              onClick={() => window.location.reload()}
              disabled={initializing || statusLoading}
            >
              🔄 Reload Page
            </button>
          </div>
          
          <details style={{ marginTop: '1.5rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              📚 Manual Setup Instructions
            </summary>
            <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              <p>If automatic start doesn't work, run this command in your terminal:</p>
              <pre style={{ 
                marginTop: '0.5rem',
                padding: '0.75rem', 
                backgroundColor: 'var(--bg-tertiary)', 
                borderRadius: 'var(--radius-md)',
                overflow: 'auto',
              }}>
                ollamadiffuser serve --port 11435
              </pre>
              <p style={{ marginTop: '0.75rem', fontSize: '0.8125rem' }}>
                💡 <strong>Note:</strong> OllamaDiffuser must run on port 11435 (not the default 8000)
              </p>
            </div>
          </details>
        </div>
      </div>
    );
  }

  return (
    <section className="scale-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1.5rem', gap: '1rem' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingBottom: '1.25rem', 
        borderBottom: '3px solid transparent',
        borderImage: 'var(--accent-gradient) 1',
      }}>
        <div style={{ flex: 1 }}>
          <h3 className="gradient-text" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.5rem' }}>
            🎨 {modelName}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <span className={executorStatus.healthy ? 'tag tag-success' : 'tag tag-error'}>
              {executorStatus.healthy ? '? Connected' : '❌ Disconnected'}
            </span>
            {executorStatus?.detail?.model_loaded && (
              <span className="tag tag-success">
                ? Model Loaded
              </span>
            )}
            {selectedLoRA && <span className="tag tag-primary">🎨 {selectedLoRA}</span>}
            {useControlNet && controlImage && <span className="tag tag-warning">🎯 ControlNet</span>}
          </div>
          {initMessage && !statusLoading && !initializing && (
            <div style={{ 
              marginTop: '0.75rem',
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              background: initMessage.includes('Error') || initMessage.includes('Warning') 
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05))'
                : 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))',
              border: `1px solid ${initMessage.includes('Error') || initMessage.includes('Warning') ? 'var(--warning)' : 'var(--success)'}`,
              fontSize: '0.8125rem',
              color: initMessage.includes('Error') || initMessage.includes('Warning') ? 'var(--warning)' : 'var(--success)',
            }}>
              {initMessage}
            </div>
          )}
        </div>
      </div>
      
      <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Main Prompts */}
        <div style={{ display: 'grid', gap: '1rem' }}>
          <label>
            <strong>Prompt</strong>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A serene mountain landscape at sunset, cinematic lighting, highly detailed..."
              rows={3}
              required
              style={{ width: '100%', marginTop: '0.25rem' }}
            />
          </label>

          <label>
            <strong>Negative Prompt</strong>
            <textarea
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="blurry, low quality, bad anatomy..."
              rows={2}
              style={{ width: '100%', marginTop: '0.25rem' }}
            />
          </label>
        </div>

        {/* LoRA Section */}
        <details className="glass" style={{ 
          padding: '1.25rem',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-md)',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05))',
        }}>
          <summary style={{ 
            cursor: 'pointer', 
            fontWeight: 600,
            color: 'var(--primary-color)',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            🎨 LoRA (Style Transfer)
          </summary>
          
          <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
            <label>
              <strong>Select LoRA:</strong>
              <select
                value={selectedLoRA}
                onChange={(e) => setSelectedLoRA(e.target.value)}
                style={{ width: '100%', marginTop: '0.25rem' }}
              >
                <option value="">None</option>
                {availableLoRAs.map((lora) => (
                  <option key={lora.name} value={lora.name}>
                    {lora.name} ({lora.size})
                  </option>
                ))}
              </select>
              <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                {selectedLoRA === 'ghibli' && '🎨 Studio Ghibli anime art style'}
                {selectedLoRA === 'sd35-turbo' && '⚡ 3x faster generation (use 8-10 steps)'}
                {selectedLoRA === 'tensorart_stable-diffusion-3.5-medium-turbo' && '⚡ Enhanced turbo mode'}
                {selectedLoRA === 'OmniConsistency' && '👤 Consistent character generation'}
                {!selectedLoRA && 'Choose a LoRA to apply artistic styles or speed up generation'}
              </small>
            </label>

            {selectedLoRA && (
              <label>
                <strong>LoRA Strength: {loraScale.toFixed(1)}</strong>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={loraScale}
                  onChange={(e) => setLoraScale(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
                <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                  {loraScale < 0.3 ? 'Subtle effect' : loraScale < 0.7 ? 'Balanced' : 'Strong effect'}
                </small>
              </label>
            )}
          </div>
        </details>

        {/* ControlNet Section */}
        <details className="glass" style={{ 
          padding: '1.25rem',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-md)',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05))',
        }}>
          <summary style={{ 
            cursor: 'pointer', 
            fontWeight: 600,
            color: 'var(--info)',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            🎯 ControlNet (Guided Generation)
          </summary>
          
          <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={useControlNet}
                onChange={(e) => setUseControlNet(e.target.checked)}
              />
              <span>Enable ControlNet (requires ControlNet model)</span>
            </label>

            {useControlNet && (
              <>
                <div>
                  <strong>Control Image:</strong>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'block', marginTop: '0.25rem', width: '100%' }}
                  />
                  <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                    Upload an image for edge/depth/pose guidance
                  </small>
                  
                  {controlImagePreview && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <img
                        src={controlImagePreview}
                        alt="Control preview"
                        style={{ 
                          maxWidth: '200px', 
                          maxHeight: '200px', 
                          borderRadius: 'var(--radius-md)',
                          border: '2px solid var(--info)',
                        }}
                      />
                    </div>
                  )}
                </div>

                <label>
                  <strong>Conditioning Scale: {controlNetScale.toFixed(1)}</strong>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={controlNetScale}
                    onChange={(e) => setControlNetScale(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                  <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                    {controlNetScale < 0.5 ? 'Loose guidance' : controlNetScale < 1.2 ? 'Balanced' : 'Strict guidance'}
                  </small>
                </label>
              </>
            )}
          </div>
        </details>

        {/* Generation Parameters */}
        <details open className="glass" style={{ 
          padding: '1.25rem',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-md)',
        }}>
          <summary style={{ 
            cursor: 'pointer', 
            fontWeight: 600,
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            ⚙️ Generation Parameters
          </summary>
          
          <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label>
              <strong>Width: {width}px</strong>
              <input
                type="range"
                min="256"
                max="2048"
                step="64"
                value={width}
                onChange={(e) => setWidth(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              <strong>Height: {height}px</strong>
              <input
                type="range"
                min="256"
                max="2048"
                step="64"
                value={height}
                onChange={(e) => setHeight(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              <strong>Steps: {steps}</strong>
              <input
                type="range"
                min="4"
                max="50"
                step="2"
                value={steps}
                onChange={(e) => setSteps(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                {steps < 10 ? 'Fast (Schnell/Turbo)' : steps < 25 ? 'Balanced' : 'High quality'}
              </small>
            </label>

            <label>
              <strong>CFG Scale: {cfgScale.toFixed(1)}</strong>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={cfgScale}
                onChange={(e) => setCfgScale(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
              <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                {cfgScale === 0 ? 'Schnell mode' : cfgScale < 5 ? 'Creative' : 'Precise'}
              </small>
            </label>

            <label>
              <strong>Number of Images: {numImages}</strong>
              <input
                type="range"
                min="1"
                max="4"
                step="1"
                value={numImages}
                onChange={(e) => setNumImages(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </label>

            <label>
              <strong>Seed: {seed === -1 ? 'Random' : seed}</strong>
              <input
                type="number"
                min="-1"
                max="2147483647"
                value={seed}
                onChange={(e) => setSeed(parseInt(e.target.value))}
                placeholder="-1 for random"
                style={{ width: '100%' }}
              />
              <small style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                Set to -1 for random seed, or use a specific number for reproducible results
              </small>
            </label>
          </div>
        </details>

        {/* Generate Button */}
        <button 
          type="submit" 
          disabled={loading || !prompt.trim()}
          style={{ 
            padding: '1.25rem 2.5rem',
            fontSize: '1.125rem',
            fontWeight: 700,
            background: loading ? 'var(--bg-tertiary)' : 'var(--accent-gradient)',
            boxShadow: loading ? 'none' : 'var(--shadow-glow)',
          }}
        >
          {loading ? (
            <>
              <div className="loading" style={{ width: '1rem', height: '1rem' }}></div>
              Generating...
            </>
          ) : (
            <>
              ?🎨 Generate {numImages > 1 ? `${numImages} Images` : 'Image'}
            </>
          )}
        </button>
      </form>

      {/* Generated Images Gallery */}
      {images.length > 0 && (
        <div className="slide-in-right">
          <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🖼️ Generated Images
          </h4>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: '1rem' 
          }}>
            {images.map((image, idx) => (
              <div 
                key={idx} 
                className="card scale-in"
                style={{ 
                  padding: '0',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'var(--transition-slow)',
                }}
                onClick={() => {
                  // Open in new tab
                  const win = window.open();
                  if (win) {
                    win.document.write(`<img src="data:image/png;base64,${image}" style="max-width:100%"/>`);
                  }
                }}
              >
                <img
                  src={`data:image/png;base64,${image}`}
                  alt={`Generated ${idx + 1}`}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
                <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Image {idx + 1} ?🔍 Click to enlarge
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
