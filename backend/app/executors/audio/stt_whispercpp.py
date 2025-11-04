from __future__ import annotations

import base64
from typing import Any, Optional

import httpx

from app.executors.base import BaseExecutor
from app.schemas.executors import ExecutionRequest, ExecutionResponse, ExecutorStatus
from app.schemas.models import LocalModel


class WhisperCppSTTExecutor(BaseExecutor):
    """Executor for whisper.cpp speech-to-text models."""

    name = "whispercpp-stt"
    modality = "stt"
    runtime_name = "whisper.cpp"

    def __init__(
        self,
        *,
        auto_start: bool = False,
        base_url: str = "http://localhost:8080",
    ) -> None:
        super().__init__(auto_start=auto_start)
        self.base_url = base_url
        self._loaded_model: Optional[str] = None
        self._client = httpx.AsyncClient(timeout=300.0)  # 5 minute timeout

    async def load_model(self, model: LocalModel) -> None:
        """
        Load a Whisper model into whisper.cpp runtime.
        
        Note: whisper.cpp typically loads the model at server startup.
        This method verifies the server is running with the model.
        """
        try:
            # Verify server is running
            response = await self._client.get(f"{self.base_url}/health")
            response.raise_for_status()
            self._loaded_model = model.name
        except Exception as e:
            raise RuntimeError(f"Failed to verify whisper.cpp server: {e}")

    async def get_status(self) -> ExecutorStatus:
        """Check if whisper.cpp service is running and healthy."""
        try:
            response = await self._client.get(f"{self.base_url}/health")
            response.raise_for_status()
            return ExecutorStatus(
                name=self.name,
                is_running=True,
                healthy=True,
                detail={"server": "whisper.cpp"},
            )
        except Exception as e:
            return ExecutorStatus(
                name=self.name,
                is_running=False,
                healthy=False,
                detail={"reason": f"Cannot connect to whisper.cpp: {str(e)}"},
            )

    async def speech_to_text(self, params: dict[str, Any]) -> ExecutionResponse:
        """
        Transcribe audio using whisper.cpp.

        Expected params:
        - audio_data: bytes or str (base64 encoded audio)
        - language: str (optional, e.g., 'en', 'es', 'auto')
        - task: str ('transcribe' or 'translate', default: 'transcribe')
        - temperature: float (default: 0.0)
        - timestamp_granularities: list[str] (optional, e.g., ['word', 'segment'])
        """
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

        language = params.get("language", "auto")
        task = params.get("task", "transcribe")
        temperature = params.get("temperature", 0.0)

        try:
            # whisper.cpp server typically uses OpenAI-compatible API
            files = {"file": ("audio.wav", audio_bytes, "audio/wav")}
            data = {
                "language": language if language != "auto" else "",
                "task": task,
                "temperature": str(temperature),
                "response_format": "json",
            }

            response = await self._client.post(
                f"{self.base_url}/inference",
                files=files,
                data=data,
            )
            response.raise_for_status()
            result = response.json()

            return ExecutionResponse(
                status="completed",
                result={
                    "text": result.get("text", ""),
                    "language": result.get("language"),
                    "segments": result.get("segments", []),
                    "words": result.get("words", []),
                },
                metadata={
                    "model": self._loaded_model,
                    "task": task,
                    "duration": result.get("duration"),
                },
            )
        except Exception as e:
            return ExecutionResponse(
                status="error",
                result={"error": str(e)},
            )

    async def execute(self, request: ExecutionRequest) -> ExecutionResponse:
        """Execute a speech-to-text request."""
        return await self.speech_to_text(request.parameters)

    async def unload_model(self, model_id: Any) -> None:
        """Unload model (no-op for whisper.cpp)."""
        self._loaded_model = None

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()
