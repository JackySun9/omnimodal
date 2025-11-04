from __future__ import annotations

import asyncio
import base64
import io
import tempfile
from pathlib import Path
from typing import Any, Optional

import torch
import whisper

from app.executors.base import BaseExecutor
from app.schemas.executors import ExecutionRequest, ExecutionResponse, ExecutorStatus
from app.schemas.models import LocalModel


class WhisperSTTExecutor(BaseExecutor):
    """Executor for OpenAI Whisper speech-to-text models."""

    name = "whisper-stt"
    modality = "stt"
    runtime_name = "OpenAI Whisper"

    def __init__(
        self,
        *,
        auto_start: bool = False,
        device: Optional[str] = None,
    ) -> None:
        super().__init__(auto_start=auto_start)
        
        # Auto-detect device if not specified
        if device is None:
            if torch.cuda.is_available():
                self.device = "cuda"
            elif torch.backends.mps.is_available():
                self.device = "mps"  # Apple Silicon
            else:
                self.device = "cpu"
        else:
            self.device = device
        
        self._model: Optional[whisper.Whisper] = None
        self._loaded_model_name: Optional[str] = None

    async def load_model(self, model: LocalModel) -> None:
        """
        Load a Whisper model.
        
        Supported model sizes: tiny, base, small, medium, large
        Can also load from local path if model is already downloaded.
        """
        try:
            # Extract model size from model name or path
            model_name = model.name.lower()
            
            # Check if it's a standard whisper model size
            whisper_sizes = ["tiny", "base", "small", "medium", "large", "large-v2", "large-v3"]
            model_size = None
            
            for size in whisper_sizes:
                if size in model_name:
                    model_size = size
                    break
            
            if model_size is None:
                # Try to load from local path
                if model.path and Path(model.path).exists():
                    model_path = model.path
                else:
                    # Default to base model
                    model_size = "base"
            
            # Load model in a thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            if model_size:
                self._model = await loop.run_in_executor(
                    None,
                    lambda: whisper.load_model(model_size, device=self.device)
                )
            else:
                self._model = await loop.run_in_executor(
                    None,
                    lambda: whisper.load_model(model_path, device=self.device)
                )
            
            self._loaded_model_name = model.name
            
        except Exception as e:
            raise RuntimeError(f"Failed to load Whisper model: {e}")

    async def get_status(self) -> ExecutorStatus:
        """Check if Whisper model is loaded and ready."""
        return ExecutorStatus(
            name=self.name,
            is_running=self._model is not None,
            healthy=self._model is not None,
            detail={
                "runtime": self.runtime_name,
                "device": self.device,
                "loaded_model": self._loaded_model_name,
                "cuda_available": torch.cuda.is_available(),
                "mps_available": torch.backends.mps.is_available(),
            },
        )

    async def speech_to_text(self, params: dict[str, Any]) -> ExecutionResponse:
        """
        Transcribe audio using OpenAI Whisper.

        Expected params:
        - audio_data: bytes or str (base64 encoded audio)
        - language: str (optional, e.g., 'en', 'es', None for auto-detect)
        - task: str ('transcribe' or 'translate', default: 'transcribe')
        - temperature: float (default: 0.0)
        - word_timestamps: bool (default: False)
        - condition_on_previous_text: bool (default: True)
        - initial_prompt: str (optional, to guide the model)
        - fp16: bool (default: True if cuda, False otherwise)
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
        condition_on_previous_text = params.get("condition_on_previous_text", True)
        initial_prompt = params.get("initial_prompt")
        fp16 = params.get("fp16", self.device == "cuda")

        try:
            # Save audio to temporary file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                tmp_file.write(audio_bytes)
                tmp_path = tmp_file.name

            # Transcribe in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: self._model.transcribe(
                    tmp_path,
                    language=language,
                    task=task,
                    temperature=temperature,
                    word_timestamps=word_timestamps,
                    condition_on_previous_text=condition_on_previous_text,
                    initial_prompt=initial_prompt,
                    fp16=fp16,
                )
            )

            # Clean up temp file
            Path(tmp_path).unlink(missing_ok=True)

            # Format response
            segments = []
            for segment in result.get("segments", []):
                seg_dict = {
                    "id": segment.get("id"),
                    "start": segment.get("start"),
                    "end": segment.get("end"),
                    "text": segment.get("text"),
                }
                
                # Add word-level timestamps if available
                if word_timestamps and "words" in segment:
                    seg_dict["words"] = segment["words"]
                
                segments.append(seg_dict)

            return ExecutionResponse(
                status="completed",
                result={
                    "text": result.get("text", ""),
                    "language": result.get("language"),
                    "segments": segments,
                },
                metadata={
                    "model": self._loaded_model_name,
                    "task": task,
                    "device": self.device,
                    "duration": result.get("duration"),
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
        """Unload the current model and free GPU memory."""
        if self._model is not None:
            del self._model
            self._model = None
            self._loaded_model_name = None
            
            # Clear GPU cache if using CUDA
            if self.device == "cuda":
                torch.cuda.empty_cache()

    async def close(self) -> None:
        """Clean up resources."""
        await self.unload_model(None)
