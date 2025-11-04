import { useState, useCallback } from 'react';
import { LocalModel, loadModelIntoExecutor, startExecutor, getExecutorStatus, getModelInfo } from '../services/api';
import { ErrorHandler } from '../utils/errorHandler';

interface UseModelInitializationOptions {
  executorName: string;
  autoStart?: boolean;
}

/**
 * Hook to handle model initialization logic
 */
export function useModelInitialization(
  model: LocalModel | null,
  options: UseModelInitializationOptions
) {
  const { executorName, autoStart = true } = options;
  const [initializing, setInitializing] = useState(false);
  const [initMessage, setInitMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    if (!model) return;

    setInitializing(true);
    setInitMessage('Initializing model...');
    setError(null);

    try {
      // Check if service is running
      let status: ExecutorStatus;
      try {
        status = await getExecutorStatus(executorName);
      } catch {
        status = {
          name: executorName,
          is_running: false,
          healthy: false,
          detail: {},
        };
      }

      // Start service if not running
      if (!status.is_running && autoStart) {
        setInitMessage('Starting service...');
        try {
          await startExecutor(executorName);
          await new Promise(resolve => setTimeout(resolve, 5000));

          // Retry getting status
          let retries = 3;
          while (retries > 0) {
            try {
              status = await getExecutorStatus(executorName);
              if (status.is_running) break;
            } catch (e) {
              console.log(`Retry ${4 - retries}/3`);
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
            retries--;
          }
        } catch (error) {
          const errorMsg = ErrorHandler.handleApiError(error);
          setInitMessage(`Failed to start service: ${errorMsg}`);
          setError(`Service startup failed: ${errorMsg}`);
          ErrorHandler.showError(errorMsg, 'Service Startup');
          setInitializing(false);
          return;
        }
      }

      // Load model if service is running
      if (status.is_running) {
        setInitMessage(`Loading model: ${model.name}...`);
        try {
          await loadModelIntoExecutor(executorName, model.name);

          // Try to get model defaults (optional)
          try {
            const modelInfo = await getModelInfo(executorName, model.name);
            setInitMessage('Model loaded successfully!');
            setTimeout(() => setInitMessage(''), 3000);
            
            // Return defaults for the caller to use
            return {
              defaults: modelInfo.default_parameters,
              status: await getExecutorStatus(executorName),
            };
          } catch {
            setInitMessage('Model loaded successfully!');
            setTimeout(() => setInitMessage(''), 3000);
            
            return {
              defaults: null,
              status: await getExecutorStatus(executorName),
            };
          }
        } catch (error) {
          const errorMsg = ErrorHandler.handleApiError(error);
          setInitMessage(`Warning: Could not load model. ${errorMsg}`);
          setError(`Model loading failed: ${errorMsg}`);
          ErrorHandler.showError(errorMsg, 'Model Loading');
        }
      } else {
        setInitMessage('Service is not running');
        setError('Service is not running. Please start the service first.');
      }
    } catch (error) {
      const errorMsg = ErrorHandler.handleApiError(error);
      setInitMessage(`Error: ${errorMsg}`);
      setError(`Initialization failed: ${errorMsg}`);
      ErrorHandler.showError(errorMsg, 'Initialization');
    } finally {
      setInitializing(false);
    }
  }, [model, executorName, autoStart]);

  return {
    initializing,
    initMessage,
    error,
    initialize,
  };
}
