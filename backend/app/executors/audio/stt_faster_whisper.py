from __future__ import annotations

import asyncio
import base64
import tempfile
from pathlib import Path
from typing import Any, Optional

from faster_whisper import WhisperModel

from app.executors.base import BaseExecutor
from app.schemas.executors import ExecutionRequest, ExecutionResponse, ExecutorStatus
from app.schemas.models import LocalModel


class FasterWhisperSTTExecutor(BaseExecutor):
    """Executor for Faster-Whisper speech-to-text models (optimized with CTranslate2)."""

    name = "faster-whisper-stt"
    modality = "stt"
    runtime_name = "Faster-Whisper"

    def __init__(
        self,
        *,
        auto_start: bool = False,
        device: Optional[str] = None,
        compute_type: Optional[str] = None,
        cpu_threads: int = 4,
        num_workers: int = 1,
    ) -> None:
        super().__init__(auto_start=auto_start)
        
        # Auto-detect device and compute type if not specified
        if device is None:
            try:
                import torch
                if torch.cuda.is_available():
                    self.device = "cuda"
                    self.compute_type = compute_type or "float16"
                else:
                    self.device = "cpu"
                    self.compute_type = compute_type or "int8"
            except ImportError:
                self.device = "cpu"
                self.compute_type = compute_type or "int8"
        else:
            self.device = device
            self.compute_type = compute_type or ("float16" if device == "cuda" else "int8")
        
        self.cpu_threads = cpu_threads
        self.num_workers = num_workers
        
        self._model: Optional[WhisperModel] = None
        self._loaded_model_name: Optional[str] = None

    async def load_model(self, model: LocalModel) -> None:
        """
        Load a Faster-Whisper model.
        
        Supported model sizes: tiny, base, small, medium, large-v1, large-v2, large-v3
        Can also load from local path or HuggingFace model ID.
        
        Faster-Whisper uses CTranslate2 for optimized inference:
        - Up to 4x faster than OpenAI Whisper
        - Lower memory usage
        - Supports int8 quantization on CPU
        """
        try:
            # Extract model size from model name or path
            model_name = model.name.lower()
            
            # Check if it's a standard whisper model size
            whisper_sizes = ["tiny", "base", "small", "medium", "large-v1", "large-v2", "large-v3", "large"]
            model_size = None
            
            for size in whisper_sizes:
                if size in model_name:
                    model_size = size
                    break
            
            # Determine model source
            if model.path and Path(model.path).exists():
                # Load from local path
                model_source = model.path
            elif model_size:
                # Load from HuggingFace Hub using standard size name
                model_source = model_size
            else:
                # Try model.name as HuggingFace model ID
                model_source = model.name
            
            # Load model in a thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            self._model = await loop.run_in_executor(
                None,
                lambda: WhisperModel(
                    model_source,
                    device=self.device,
                    compute_type=self.compute_type,
                    cpu_threads=self.cpu_threads,
                    num_workers=self.num_workers,
                )
            )
            
            self._loaded_model_name = model.name
            
        except Exception as e:
            raise RuntimeError(f"Failed to load Faster-Whisper model: {e}")

    async def get_status(self) -> ExecutorStatus:
        """Check if Faster-Whisper model is loaded and ready."""
        cuda_available = False
        try:
            import torch
            cuda_available = torch.cuda.is_available()
        except ImportError:
            pass
        
        return ExecutorStatus(
            name=self.name,
            is_running=self._model is not None,
            healthy=self._model is not None,
            detail={
                "runtime": self.runtime_name,
                "device": self.device,
                "compute_type": self.compute_type,
                "loaded_model": self._loaded_model_name,
                "cuda_available": cuda_available,
                "cpu_threads": self.cpu_threads,
            },
        )

    async def speech_to_text(self, params: dict[str, Any]) -> ExecutionResponse:
        """
        Transcribe audio using Faster-Whisper.

        Expected params:
        - audio_data: bytes or str (base64 encoded audio)
        - language: str (optional, e.g., 'en', 'es', None for auto-detect)
        - task: str ('transcribe' or 'translate', default: 'transcribe')
        - temperature: float or list of floats (default: 0.0)
        - word_timestamps: bool (default: False)
        - vad_filter: bool (default: False, use voice activity detection)
        - vad_parameters: dict (optional, VAD parameters)
        - initial_prompt: str (optional, to guide the model)
        - condition_on_previous_text: bool (default: True)
        - beam_size: int (default: 5)
        - best_of: int (default: 5, used with temperature sampling)
        - patience: float (default: 1.0)
        - length_penalty: float (default: 1.0)
        - compression_ratio_threshold: float (default: 2.4)
        - log_prob_threshold: float (default: -1.0)
        - no_speech_threshold: float (default: 0.6)
        """
        if self._model is None:
            return ExecutionResponse(
                status="error",
                result={"error": "No model loaded. Please load a model first."},
            )

        audio_data = params.get("audio_data")
        if not audio_data:
            return ExecutionResponse(
                status="error",
                result={"error": "No audio data provided"},
            )

        # Convert audio to bytes if base64 string
        if isinstance(audio_data, str):
            try:
                audio_bytes = base64.b64decode(audio_data)
            except Exception as e:
                return ExecutionResponse(
                    status="error",
                    result={"error": f"Invalid base64 audio data: {e}"},
                )
        else:
            audio_bytes = audio_data

        # Extract parameters
        language = params.get("language")  # None for auto-detect
        task = params.get("task", "transcribe")
        temperature = params.get("temperature", 0.0)
        word_timestamps = params.get("word_timestamps", False)
        vad_filter = params.get("vad_filter", False)
        vad_parameters = params.get("vad_parameters")
        initial_prompt = params.get("initial_prompt")
        condition_on_previous_text = params.get("condition_on_previous_text", True)
        beam_size = params.get("beam_size", 5)
        best_of = params.get("best_of", 5)
        patience = params.get("patience", 1.0)
        length_penalty = params.get("length_penalty", 1.0)
        compression_ratio_threshold = params.get("compression_ratio_threshold", 2.4)
        log_prob_threshold = params.get("log_prob_threshold", -1.0)
        no_speech_threshold = params.get("no_speech_threshold", 0.6)

        try:
            # Save audio to temporary file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                tmp_file.write(audio_bytes)
                tmp_path = tmp_file.name

            # Transcribe in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            
            def _transcribe():
                segments, info = self._model.transcribe(
                    tmp_path,
                    language=language,
                    task=task,
                    temperature=temperature,
                    word_timestamps=word_timestamps,
                    vad_filter=vad_filter,
                    vad_parameters=vad_parameters,
                    initial_prompt=initial_prompt,
                    condition_on_previous_text=condition_on_previous_text,
                    beam_size=beam_size,
                    best_of=best_of,
                    patience=patience,
                    length_penalty=length_penalty,
                    compression_ratio_threshold=compression_ratio_threshold,
                    log_prob_threshold=log_prob_threshold,
                    no_speech_threshold=no_speech_threshold,
                )
                
                # Convert generator to list and extract info
                segments_list = list(segments)
                return segments_list, info
            
            segments_list, info = await loop.run_in_executor(None, _transcribe)

            # Clean up temp file
            Path(tmp_path).unlink(missing_ok=True)

            # Format response
            formatted_segments = []
            full_text = ""
            
            for segment in segments_list:
                seg_dict = {
                    "id": segment.id,
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text,
                    "avg_logprob": segment.avg_logprob,
                    "compression_ratio": segment.compression_ratio,
                    "no_speech_prob": segment.no_speech_prob,
                }
                
                # Add word-level timestamps if available
                if word_timestamps and segment.words:
                    seg_dict["words"] = [
                        {
                            "start": word.start,
                            "end": word.end,
                            "word": word.word,
                            "probability": word.probability,
                        }
                        for word in segment.words
                    ]
                
                formatted_segments.append(seg_dict)
                full_text += segment.text

            return ExecutionResponse(
                status="completed",
                result={
                    "text": full_text.strip(),
                    "language": info.language,
                    "language_probability": info.language_probability,
                    "segments": formatted_segments,
                },
                metadata={
                    "model": self._loaded_model_name,
                    "task": task,
                    "device": self.device,
                    "compute_type": self.compute_type,
                    "duration": info.duration,
                    "duration_after_vad": info.duration_after_vad if vad_filter else None,
                    "transcription_options": info.transcription_options.__dict__,
                    "vad_options": info.vad_options.__dict__ if info.vad_options else None,
                },
            )
        except Exception as e:
            # Clean up temp file in case of error
            try:
                Path(tmp_path).unlink(missing_ok=True)
            except:
                pass
            
            return ExecutionResponse(
                status="error",
                result={"error": str(e)},
            )

    async def execute(self, request: ExecutionRequest) -> ExecutionResponse:
        """Execute a speech-to-text request."""
        return await self.speech_to_text(request.parameters)

    async def unload_model(self, model_id: Any) -> None:
        """Unload the current model and free memory."""
        if self._model is not None:
            del self._model
            self._model = None
            self._loaded_model_name = None
            
            # Clear GPU cache if using CUDA
            if self.device == "cuda":
                try:
                    import torch
                    torch.cuda.empty_cache()
                except ImportError:
                    pass

    async def close(self) -> None:
        """Clean up resources."""
        await self.unload_model(None)
