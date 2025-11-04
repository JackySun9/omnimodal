import { useCallback, useRef } from 'react';
import { ErrorHandler } from '../utils/errorHandler';

interface StreamingOptions {
  onChunk?: (chunk: string) => void;
  onThinking?: (thinking: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: string) => void;
  url: string;
  body: Record<string, unknown>;
}

/**
 * Hook for handling streaming responses
 */
export function useStreamingResponse() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const stream = useCallback(async (options: StreamingOptions) => {
    // Cancel any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    let accumulatedText = '';
    let accumulatedThinking = '';

    try {
      const response = await fetch(options.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options.body),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            // Handle SSE format
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                continue;
              }

              const parsed = JSON.parse(data);

              // Handle thinking chunks
              if (parsed.thinking) {
                accumulatedThinking += parsed.thinking;
                options.onThinking?.(accumulatedThinking);
              }

              // Handle text chunks
              if (parsed.text) {
                accumulatedText += parsed.text;
                options.onChunk?.(parsed.text);
              }

              // Handle delta format
              if (parsed.delta?.content) {
                accumulatedText += parsed.delta.content;
                options.onChunk?.(parsed.delta.content);
              }

              // Handle message format
              if (parsed.message?.content) {
                accumulatedText += parsed.message.content;
                options.onChunk?.(parsed.message.content);
              }
            } else {
              // Try parsing as JSON directly
              const parsed = JSON.parse(line);
              if (parsed.text) {
                accumulatedText += parsed.text;
                options.onChunk?.(parsed.text);
              }
            }
          } catch (e) {
            // Ignore JSON parse errors for incomplete chunks
            continue;
          }
        }
      }

      options.onComplete?.(accumulatedText);
      return { text: accumulatedText, thinking: accumulatedThinking };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Stream was cancelled, ignore
        return { text: accumulatedText, thinking: accumulatedThinking };
      }

      const errorMsg = ErrorHandler.handleApiError(error);
      options.onError?.(errorMsg);
      ErrorHandler.showError(errorMsg, 'Streaming');
      throw error;
    } finally {
      abortControllerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return { stream, cancel };
}
