import { useMutation } from '@tanstack/react-query';
import {
  transcribeAudio,
  STTTranscriptionRequest,
  STTTranscriptionResponse,
} from '../services/api';
import { useErrorHandler } from './useErrorHandler';

/**
 * Hook for transcribing audio
 */
export function useTranscribeAudio() {
  const { handleError } = useErrorHandler('STT');
  
  return useMutation({
    mutationFn: (request: STTTranscriptionRequest) => transcribeAudio(request),
    onError: handleError,
  });
}
