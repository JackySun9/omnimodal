import { FormEvent, useEffect, useState, useRef } from 'react';
import {
  STTExecutor,
  WhisperModel,
  STTSegment,
  STTTranscriptionRequest,
} from '../../../services/api';
import { useSTTExecutors, useSTTModelsList, useLoadSTTModel } from '../../../hooks';
import { useTranscribeAudio } from '../../../hooks/useSTTTranscription';
import { useErrorHandler } from '../../../hooks/useErrorHandler';

interface STTWorkspaceProps {
  modelId: string;
}

const LANGUAGES = [
  { code: null, name: 'Auto-detect' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'tr', name: 'Turkish' },
  { code: 'pl', name: 'Polish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'th', name: 'Thai' },
  { code: 'id', name: 'Indonesian' },
  { code: 'he', name: 'Hebrew' },
  { code: 'fa', name: 'Persian' },
];

export function STTWorkspace({ modelId }: STTWorkspaceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [transcription, setTranscription] = useState<string>('');
  const [segments, setSegments] = useState<STTSegment[]>([]);
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hooks
  const { data: executorsData, isLoading: executorsLoading } = useSTTExecutors();
  const { data: modelsData, isLoading: modelsLoading } = useSTTModelsList();
  const loadSTTModelMutation = useLoadSTTModel();
  const transcribeMutation = useTranscribeAudio();
  const { handleError, handleSuccess, handleLoading } = useErrorHandler('STT');

  // Auto-init state
  const [autoInitializing, setAutoInitializing] = useState(false);
  const [autoInitMessage, setAutoInitMessage] = useState<string>('');
  const hasAutoInitializedRef = useRef(false);

  // Configuration
  const [selectedExecutor, setSelectedExecutor] = useState('faster-whisper-stt');
  const [selectedModel, setSelectedModel] = useState('base');
  const [language, setLanguage] = useState<string | null>(null);
  const [task, setTask] = useState<'transcribe' | 'translate'>('transcribe');
  const [temperature, setTemperature] = useState(0.0);
  const [wordTimestamps, setWordTimestamps] = useState(false);
  const [vadFilter, setVadFilter] = useState(true);
  const [beamSize, setBeamSize] = useState(5);
  const [initialPrompt, setInitialPrompt] = useState('');
  
  const [showAdvanced, setShowAdvanced] = useState(false);

  const executors = executorsData?.executors || {};
  const models = modelsData?.models || [];
  const loadingInfo = executorsLoading || modelsLoading;

  // Auto-select recommended executor and first model
  useEffect(() => {
    if (executorsData?.recommended) {
      setSelectedExecutor(executorsData.recommended);
    }
    if (models.length > 0 && selectedModel === 'base') {
      setSelectedModel(models[0].name);
    }
  }, [executorsData, models, selectedModel]);

  // Auto-download and load model on first use
  useEffect(() => {
    const autoInitialize = async () => {
      // Only run once
      if (hasAutoInitializedRef.current) return;
      
      // Wait for data to load
      if (loadingInfo || !executorsData || !modelsData || models.length === 0) return;
      
      const executorInfo = executors[selectedExecutor];
      if (!executorInfo?.is_running) {
        // Executor not running, don't auto-init
        hasAutoInitializedRef.current = true;
        return;
      }

      // Check if model is already loaded by checking executor detail
      // The backend may store this in different fields
      const loadedModel = executorInfo.detail?.loaded_model as string | undefined;
      const modelReady = executorInfo.detail?.model_ready as boolean | undefined;
      
      if (loadedModel || modelReady) {
        // Model is already loaded or ready
        if (loadedModel && loadedModel !== selectedModel) {
          setSelectedModel(loadedModel);
        }
        hasAutoInitializedRef.current = true;
        return;
      }

      // No model loaded, auto-download and load
      const defaultModel = modelsData.recommendation || models[0].name;
      if (defaultModel !== selectedModel) {
        setSelectedModel(defaultModel);
        // Wait a tick for state to update
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      try {
        setAutoInitializing(true);
        setAutoInitMessage(`Downloading and loading model "${defaultModel}"...`);
        handleLoading(`Setting up ${defaultModel} model for first-time use...`);

        // The loadSTTModel API will automatically download if not present
        await loadSTTModelMutation.mutateAsync({
          executorName: selectedExecutor,
          modelSize: defaultModel,
        });

        handleSuccess(`Model "${defaultModel}" is ready to use!`);
        setAutoInitMessage('');
        hasAutoInitializedRef.current = true;
      } catch (err) {
        // Extract detailed error message
        let errorMsg = 'Failed to initialize model';
        if (err && typeof err === 'object' && 'response' in err) {
          const axiosError = err as any;
          if (axiosError.response?.data?.detail) {
            errorMsg = axiosError.response.data.detail;
          } else {
            errorMsg = handleError(err);
          }
        } else {
          errorMsg = handleError(err);
        }
        
        setAutoInitMessage(`Failed to initialize: ${errorMsg}`);
        console.error('STT auto-init error:', err);
        // Don't set hasAutoInitializedRef to true so user can retry
      } finally {
        setAutoInitializing(false);
      }
    };

    void autoInitialize();
  }, [executorsData, modelsData, models, selectedExecutor, loadingInfo, executors, loadSTTModelMutation, handleError, handleSuccess, handleLoading]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setFile(files[0]);
      setError(null);
    }
  };

  const handleLoadModel = async () => {
    if (!selectedExecutor || !selectedModel) return;

    try {
      await loadSTTModelMutation.mutateAsync({
        executorName: selectedExecutor,
        modelSize: selectedModel,
      });
      handleSuccess(`Model "${selectedModel}" loaded successfully into ${selectedExecutor}!`);
    } catch (err) {
      handleError(err);
    }
  };

  const handleTranscribe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setTranscription('');
    setSegments([]);

    try {
      const request: STTTranscriptionRequest = {
        audio: file,
        executor: selectedExecutor,
        language: language,
        task: task,
        temperature: temperature,
        word_timestamps: wordTimestamps,
        initial_prompt: initialPrompt || null,
        vad_filter: vadFilter,
        beam_size: beamSize,
      };

      const response = await transcribeMutation.mutateAsync(request);
      setTranscription(response.text);
      setSegments(response.segments);
      setMetadata(response.metadata);
    } catch (err) {
      const errorMsg = handleError(err);
      setError(`Transcription failed: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcription);
    alert('Transcription copied to clipboard!');
  };

  const downloadTranscription = () => {
    const blob = new Blob([transcription], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loadingInfo) {
    return (
      <section style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="loading shimmer" style={{ width: '3rem', height: '3rem', margin: '0 auto', borderRadius: '50%' }}></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading STT configuration...</p>
      </section>
    );
  }

  const selectedExecutorInfo = executors[selectedExecutor];
  const selectedModelInfo = models.find(m => m.name === selectedModel);

  return (
    <section className="fade-in" style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Auto-initialization indicator */}
      {autoInitializing && (
        <div className="glass" style={{
          marginBottom: '2rem',
          padding: '1rem',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'var(--info-bg)',
          border: '1px solid var(--info)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <div className="loading" style={{ width: '1.5rem', height: '1.5rem' }}></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Setting up Speech-to-Text...</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {autoInitMessage || 'Downloading and loading model for first-time use'}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 className="gradient-text" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '2rem' }}>🎤</span>
          <span>Speech-to-Text</span>
        </h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Transcribe audio files using Whisper models
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Configuration Panel */}
        <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚙️</span>
            <span>Configuration</span>
          </h3>

          <form onSubmit={handleTranscribe} style={{ display: 'grid', gap: '1.25rem' }}>
            {/* File Upload */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
                Audio File:
              </label>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                style={{ 
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px dashed var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                }}
              />
              {file && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            {/* Executor Selection */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
                Executor:
              </label>
              <select
                value={selectedExecutor}
                onChange={(e) => setSelectedExecutor(e.target.value)}
                style={{ width: '100%' }}
              >
                {Object.keys(executors).map((key) => {
                  const exec = executors[key];
                  return (
                    <option key={key} value={key}>
                      {key} {exec.is_running ? '✅' : '⚠️'} ({exec.detail.runtime || 'Unknown'})
                    </option>
                  );
                })}
              </select>
              {selectedExecutorInfo && (
                <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <span>Status: {selectedExecutorInfo.is_running ? <span style={{ color: 'var(--success)' }}>✅ Running</span> : <span style={{ color: 'var(--warning)' }}>⚠️ Not Ready</span>}</span>
                    {selectedExecutorInfo.detail.device && (
                      <span>Device: {selectedExecutorInfo.detail.device as string}</span>
                    )}
                    {selectedExecutorInfo.detail.compute_type && (
                      <span>Type: {selectedExecutorInfo.detail.compute_type as string}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Model Selection */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
                Model Size:
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{ width: '100%' }}
              >
                {models.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name} - {model.params} ({model.vram})
                  </option>
                ))}
              </select>
              {selectedModelInfo && (
                <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
                  <div><strong>Speed:</strong> {selectedModelInfo.speed}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{selectedModelInfo.use_case}</div>
                </div>
              )}
              <button
                type="button"
                onClick={handleLoadModel}
                disabled={loadSTTModelMutation.isPending}
                style={{
                  marginTop: '0.5rem',
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  background: loadSTTModelMutation.isPending ? 'var(--bg-tertiary)' : 'var(--secondary-gradient)',
                }}
              >
                {loadSTTModelMutation.isPending ? '🔄 Loading...' : '📦 Pre-load Model'}
              </button>
            </div>

            {/* Language Selection */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
                Language:
              </label>
              <select
                value={language || ''}
                onChange={(e) => setLanguage(e.target.value || null)}
                style={{ width: '100%' }}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code || 'auto'} value={lang.code || ''}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Task Selection */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
                Task:
              </label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', border: `2px solid ${task === 'transcribe' ? 'var(--primary-color)' : 'var(--border-color)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="task"
                    value="transcribe"
                    checked={task === 'transcribe'}
                    onChange={(e) => setTask(e.target.value as 'transcribe')}
                  />
                  <span>Transcribe</span>
                </label>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', border: `2px solid ${task === 'translate' ? 'var(--primary-color)' : 'var(--border-color)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="task"
                    value="translate"
                    checked={task === 'translate'}
                    onChange={(e) => setTask(e.target.value as 'translate')}
                  />
                  <span>Translate to EN</span>
                </label>
              </div>
            </div>

            {/* Quick Options */}
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={wordTimestamps}
                  onChange={(e) => setWordTimestamps(e.target.checked)}
                />
                <span>Include word-level timestamps</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={vadFilter}
                  onChange={(e) => setVadFilter(e.target.checked)}
                />
                <span>Enable VAD filtering (skip silence)</span>
              </label>
            </div>

            {/* Advanced Options */}
            <details open={showAdvanced} onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '1rem', userSelect: 'none' }}>
                ⚙️ Advanced Options
              </summary>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Temperature: {temperature.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    0.0 = deterministic, higher = more random
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Beam Size: {beamSize}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={beamSize}
                    onChange={(e) => setBeamSize(parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Higher = better accuracy but slower
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Initial Prompt (optional):
                  </label>
                  <textarea
                    value={initialPrompt}
                    onChange={(e) => setInitialPrompt(e.target.value)}
                    placeholder="Guide the model's transcription style..."
                    rows={2}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>
              </div>
            </details>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!file || loading || !selectedExecutorInfo?.is_running}
              style={{
                padding: '1rem 1.5rem',
                fontSize: '1.0625rem',
                fontWeight: 600,
                background: loading ? 'var(--bg-tertiary)' : 'var(--primary-gradient)',
                boxShadow: loading ? 'none' : 'var(--shadow-glow)',
                cursor: (!file || loading || !selectedExecutorInfo?.is_running) ? 'not-allowed' : 'pointer',
                opacity: (!file || loading || !selectedExecutorInfo?.is_running) ? 0.6 : 1,
              }}
            >
              {loading ? '🔄 Transcribing...' : '🎤 Transcribe Audio'}
            </button>
          </form>
        </div>

        {/* Results Panel */}
        <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>⚙️</span>
              <span>Transcription</span>
            </div>
            {transcription && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}
                  title="Copy to clipboard"
                >
                  📋 Copy
                </button>
                <button
                  type="button"
                  onClick={downloadTranscription}
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}
                  title="Download as text file"
                >
                  📥 Download
                </button>
              </div>
            )}
          </h3>

          {error && (
            <div style={{
              padding: '1rem',
              backgroundColor: 'var(--error-bg)',
              border: '1px solid var(--error)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--error)',
              marginBottom: '1rem',
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="loading shimmer" style={{ width: '3rem', height: '3rem', margin: '0 auto', borderRadius: '50%' }}></div>
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Transcribing audio...</p>
            </div>
          )}

          {!loading && transcription && (
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              {/* Full Transcription */}
              <div>
                <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Full Text
                </h4>
                <div style={{
                  padding: '1rem',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '300px',
                  overflowY: 'auto',
                }}>
                  {transcription}
                </div>
              </div>

              {/* Metadata */}
              {metadata && Object.keys(metadata).length > 0 && (
                <div>
                  <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Metadata
                  </h4>
                  <div style={{
                    padding: '1rem',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    display: 'grid',
                    gap: '0.5rem',
                  }}>
                    {Object.entries(metadata).map(([key, value]) => (
                      <div key={key} style={{ display: 'flex', gap: '0.5rem' }}>
                        <strong>{key}:</strong>
                        <span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Segments */}
              {segments && segments.length > 0 && (
                <div>
                  <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Segments ({segments.length})
                  </h4>
                  <div style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    display: 'grid',
                    gap: '0.5rem',
                  }}>
                    {segments.map((segment) => (
                      <div
                        key={segment.id}
                        style={{
                          padding: '0.75rem',
                          backgroundColor: 'var(--bg-secondary)',
                          borderRadius: 'var(--radius-md)',
                          borderLeft: '3px solid var(--primary-color)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          <span>#{segment.id}</span>
                          <span>{formatTime(segment.start)} ? {formatTime(segment.end)}</span>
                        </div>
                        <div style={{ fontSize: '0.9375rem' }}>{segment.text}</div>
                        {segment.words && segment.words.length > 0 && wordTimestamps && (
                          <details style={{ marginTop: '0.5rem' }}>
                            <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              Show word timings ({segment.words.length} words)
                            </summary>
                            <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                              {segment.words.map((word, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    backgroundColor: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.75rem',
                                  }}
                                  title={`${formatTime(word.start)} - ${formatTime(word.end)}`}
                                >
                                  {word.word}
                                </span>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && !transcription && !error && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎤</div>
              <p>Upload an audio file and click "Transcribe Audio" to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Model Information */}
      <div className="glass" style={{ padding: '1.5rem', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)' }}>
        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>⚙️</span>
          <span>Available Models</span>
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Model</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Parameters</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>VRAM</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Speed</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Use Case</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <tr
                  key={model.name}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: model.name === selectedModel ? 'rgba(var(--primary-color-rgb), 0.1)' : undefined,
                  }}
                >
                  <td style={{ padding: '0.75rem', fontWeight: model.name === selectedModel ? 600 : 400 }}>
                    {model.name}
                    {model.name === selectedModel && <span style={{ marginLeft: '0.5rem' }}>?</span>}
                  </td>
                  <td style={{ padding: '0.75rem' }}>{model.params}</td>
                  <td style={{ padding: '0.75rem' }}>{model.vram}</td>
                  <td style={{ padding: '0.75rem' }}>{model.speed}</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{model.use_case}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
