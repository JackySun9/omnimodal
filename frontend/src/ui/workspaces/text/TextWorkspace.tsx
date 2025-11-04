import { FormEvent, useEffect, useState, useRef } from 'react';
import { ExecutionResponse } from '../../../services/api';
import { useModels, useExecutorStatus } from '../../../hooks/useModels';
import { useJobExecutionWithCallback } from '../../../hooks/useJobExecution';
import { useStreamingResponse } from '../../../hooks/useStreamingResponse';
import { useErrorHandler } from '../../../hooks/useErrorHandler';

interface TextWorkspaceProps {
  modelId: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string; // DeepSeek R1 thinking process
  streaming?: boolean;
}

export function TextWorkspace({ modelId }: TextWorkspaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [modelName, setModelName] = useState<string>('');
  const [useStreaming, setUseStreaming] = useState(true);
  const [showThinking, setShowThinking] = useState(false);
  const [useHistory, setUseHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Configuration
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.');

  // Hooks
  const { data: models } = useModels();
  const { data: executorStatus, isLoading: statusLoading, error: statusError } = useExecutorStatus('ollama');
  const { stream } = useStreamingResponse();
  const { handleError } = useErrorHandler('Text Workspace');
  const executeJobMutation = useJobExecutionWithCallback('ollama', {
    onError: handleError,
  });

  // Get model name from models data
  useEffect(() => {
    if (models) {
      const model = models.find(m => m.id === modelId);
      if (model) {
        setModelName(model.name);
      }
    }
  }, [models, modelId]);

  // Handle errors
  useEffect(() => {
    if (statusError) {
      handleError(statusError);
    }
  }, [statusError, handleError]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() || loading || !modelName) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const currentInput = input.trim();
    
    // Add user message to display
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    if (useStreaming) {
      await handleStreamingResponse(currentInput);
    } else {
      await handleNormalResponse(currentInput);
    }
  };

  const parseThinkingAndContent = (text: string): { thinking: string; content: string } => {
    // DeepSeek R1 format: <think>...</think> then actual response
    const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>([\s\S]*)/);
    if (thinkMatch) {
      return {
        thinking: thinkMatch[1].trim(),
        content: thinkMatch[2].trim(),
      };
    }
    
    // Alternative format: <think>...</think> at the end
    const thinkAtEndMatch = text.match(/([\s\S]*?)<think>([\s\S]*?)<\/think>/);
    if (thinkAtEndMatch) {
      return {
        thinking: thinkAtEndMatch[2].trim(),
        content: thinkAtEndMatch[1].trim(),
      };
    }
    
    // No thinking tags, return as-is
    return { thinking: '', content: text };
  };

  const handleStreamingResponse = async (prompt: string) => {
    const messageIndex = messages.length + 1;
    setMessages((prev) => [...prev, { role: 'assistant', content: '', thinking: '', streaming: true }]);

    const conversationHistory = useHistory ? messages.map(m => ({
      role: m.role,
      content: m.content,
    })) : [];

    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
    
    try {
      await stream({
        url: `${baseURL}/executors/ollama/stream`,
        body: {
          model_id: modelId,
          parameters: {
            model: modelName,
            prompt: prompt,
            system: systemPrompt,
            temperature,
            max_tokens: maxTokens,
            history: conversationHistory,
          },
        },
        onChunk: (chunk) => {
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            const accumulated = (lastMessage.content || '') + chunk;
            const { thinking, content } = parseThinkingAndContent(accumulated);
            
            const newMessages = [...prev];
            newMessages[messageIndex] = {
              role: 'assistant',
              thinking: thinking,
              content: content,
              streaming: true,
            };
            return newMessages;
          });
        },
        onThinking: (thinking) => {
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[messageIndex];
            if (lastMessage) {
              newMessages[messageIndex] = {
                ...lastMessage,
                thinking: thinking,
              };
            }
            return newMessages;
          });
        },
        onComplete: () => {
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[messageIndex];
            if (lastMessage) {
              newMessages[messageIndex] = {
                ...lastMessage,
                streaming: false,
              };
            }
            return newMessages;
          });
        },
        onError: (errorMsg) => {
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[messageIndex] = {
              role: 'assistant',
              content: `Error: ${errorMsg}`,
              streaming: false,
            };
            return newMessages;
          });
        },
      });
    } catch (error) {
      const errorMsg = handleError(error);
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[messageIndex] = {
          role: 'assistant',
          content: `Error: ${errorMsg}`,
          streaming: false,
        };
        return newMessages;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNormalResponse = async (prompt: string) => {
    const conversationHistory = useHistory ? messages.map(m => ({
      role: m.role,
      content: m.content,
    })) : [];

    try {
      const response: ExecutionResponse = await executeJobMutation.mutateAsync({
        model_id: modelId,
        parameters: {
          model: modelName,
          prompt: prompt,
          system: systemPrompt,
          temperature,
          max_tokens: maxTokens,
          history: conversationHistory,
        },
      });

      if (response.status === 'completed' && response.result) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: (response.result.text as string) || 'No response',
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else if (response.status === 'error' && response.result) {
        const errorMsg = response.result.error as string || 'Unknown error';
        handleError(errorMsg);
        const errorMessage: Message = {
          role: 'assistant',
          content: `Error: ${errorMsg}`,
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMsg = handleError(error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${errorMsg}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  if (statusLoading || !modelName) {
    return (
      <div className="fade-in" style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="loading" style={{ width: '2rem', height: '2rem', margin: '0 auto' }}></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading workspace...</p>
      </div>
    );
  }

  if (!executorStatus?.is_running) {
    return (
      <div className="fade-in" style={{ padding: '2rem' }}>
        <div style={{ 
          padding: '2rem', 
          backgroundColor: 'var(--warning-bg)', 
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--warning)',
        }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ⚠️ Ollama Not Running
          </h3>
          <p>Please start Ollama to use text generation.</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Status: {executorStatus?.detail?.reason as string || 'Unknown'}
          </p>
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
        borderImage: 'var(--primary-gradient) 1',
      }}>
        <div>
          <h3 className="gradient-text" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.5rem' }}>
            💬 {modelName}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
            <span className={executorStatus.healthy ? 'tag tag-success' : 'tag tag-error'}>
              {executorStatus.healthy ? '✅ Connected' : '❌ Disconnected'}
            </span>
            <span className="tag tag-primary">
              {useStreaming ? '📡 Streaming' : '📝 Standard'}
            </span>
            <span className={useHistory ? 'tag tag-success' : 'tag tag-warning'}>
              {useHistory ? '📚 With History' : '📄 Stateless'}
            </span>
          </div>
        </div>
        <button 
          type="button" 
          onClick={clearChat} 
          disabled={loading || messages.length === 0}
          style={{ 
            background: 'var(--error-gradient)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          🗑️ Clear Chat
        </button>
      </div>
      
      {/* Configuration Panel */}
      <details className="glass" style={{ 
        padding: '1rem', 
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-md)',
      }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          ⚙️ Configuration
        </summary>
        <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={useStreaming}
                onChange={(e) => setUseStreaming(e.target.checked)}
              />
              <span>📡 Enable Streaming (real-time responses)</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={useHistory}
                onChange={(e) => setUseHistory(e.target.checked)}
                disabled={loading}
              />
              <span>📚 Use Conversation History</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={showThinking}
                onChange={(e) => setShowThinking(e.target.checked)}
              />
              <span>?? Show Thinking Process (DeepSeek R1)</span>
            </label>
          </div>
          
          {!useHistory && (
            <div style={{ 
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05))',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              fontSize: '0.8125rem',
              color: 'var(--warning)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <span>❌</span>
              <span><strong>Stateless Mode:</strong> Each message will be treated independently without conversation context.</span>
            </div>
          )}

          <label>
            System Prompt:
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={2}
              style={{ width: '100%', marginTop: '0.25rem' }}
            />
          </label>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label>
              Temperature: {temperature.toFixed(1)}
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
              <small style={{ color: 'var(--text-secondary)' }}>
                {temperature < 0.5 ? 'Focused' : temperature < 1.2 ? 'Balanced' : 'Creative'}
              </small>
            </label>

            <label>
              Max Tokens: {maxTokens}
              <input
                type="range"
                min="64"
                max="2048"
                step="64"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <small style={{ color: 'var(--text-secondary)' }}>
                {maxTokens < 256 ? 'Short' : maxTokens < 1024 ? 'Medium' : 'Long'}
              </small>
            </label>
          </div>
        </div>
      </details>

      {/* Chat Messages */}
      <div
        className="glass"
        style={{
          flex: 1,
          overflowY: 'auto',
          borderRadius: 'var(--radius-xl)',
          padding: '1.5rem',
          boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.05)',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
            <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>Start a conversation</p>
            <p style={{ fontSize: '0.875rem' }}>Ask anything - your AI is ready!</p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={idx === messages.length - 1 ? 'slide-in-right' : ''}
                style={{
                  marginBottom: '1rem',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-xl)',
                  background: msg.role === 'user' 
                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))'
                    : 'var(--bg-primary)',
                  border: `2px solid ${msg.role === 'user' ? 'rgba(99, 102, 241, 0.3)' : 'var(--border-color)'}`,
                  boxShadow: 'var(--shadow-md)',
                  transition: 'var(--transition)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>
                    {msg.role === 'user' ? '??' : '??'}
                  </span>
                  <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {msg.role === 'user' ? 'You' : modelName}
                  </strong>
                  {msg.streaming && (
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  )}
                  {msg.thinking && !showThinking && (
                    <span style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--text-secondary)',
                      fontStyle: 'italic',
                      marginLeft: 'auto',
                    }}>
                      ?? Thinking hidden
                    </span>
                  )}
                </div>
                
                {/* Thinking Process (collapsible) */}
                {msg.thinking && showThinking && (
                  <details style={{ 
                    marginBottom: '0.75rem',
                    padding: '0.75rem',
                    backgroundColor: 'var(--info-bg)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--info)',
                    transition: 'var(--transition)',
                  }}>
                    <summary style={{ 
                      cursor: 'pointer', 
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: 'var(--info)',
                      userSelect: 'none',
                    }}>
                      ?? Thinking Process
                    </summary>
                    <p style={{ 
                      marginTop: '0.5rem',
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.6',
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      fontStyle: 'italic',
                    }}>
                      {msg.thinking}
                    </p>
                  </details>
                )}
                
                {/* Actual Response */}
                <p style={{ 
                  marginTop: '0.5rem', 
                  whiteSpace: 'pre-wrap', 
                  lineHeight: '1.6',
                  color: 'var(--text-primary)',
                }}>
                  {msg.content || (msg.streaming && '...')}
                </p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
            placeholder="Type your message... (Shift+Enter for new line)"
            disabled={loading}
            rows={3}
            style={{ 
              width: '100%', 
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '2px solid var(--border-color)',
              resize: 'vertical',
              fontSize: '0.9375rem',
              transition: 'var(--transition)',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
          />
        </div>
        <button 
          type="submit" 
          disabled={loading || !input.trim()}
          style={{ 
            height: 'fit-content',
            padding: '1rem 2rem',
            fontSize: '1rem',
            background: loading ? 'var(--bg-tertiary)' : 'var(--primary-gradient)',
            boxShadow: loading ? 'none' : 'var(--shadow-glow)',
            fontWeight: 700,
          }}
        >
          {loading ? (
            <>
              <div className="loading" style={{ width: '1rem', height: '1rem' }}></div>
              Thinking...
            </>
          ) : (
            <>
              ? Send
            </>
          )}
        </button>
      </form>

      {/* Status Bar */}
      <div className="glass" style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.875rem 1.25rem',
        borderRadius: 'var(--radius-xl)',
        fontSize: '0.8125rem',
        color: 'var(--text-secondary)',
        fontWeight: 500,
        boxShadow: 'var(--shadow-md)',
      }}>
        <span>
          {messages.filter(m => m.role === 'user').length} messages ? 
          {messages.filter(m => m.role === 'assistant').length} responses
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={executorStatus.healthy ? 'pulse' : ''} style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%',
            backgroundColor: executorStatus.healthy ? 'var(--success)' : 'var(--error)',
          }}></span>
          {executorStatus.healthy ? 'Ready' : 'Disconnected'}
        </span>
      </div>
    </section>
  );
}
