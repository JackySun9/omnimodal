from __future__ import annotations

import base64
from typing import Any, Optional

import httpx

from app.executors.base import BaseExecutor
from app.schemas.executors import ExecutionRequest, ExecutionResponse, ExecutorStatus
from app.schemas.models import LocalModel


class PiperTTSExecutor(BaseExecutor):
    """Executor for Piper text-to-speech models."""

    name = "piper-tts"
    modality = "tts"
    runtime_name = "piper"

    def __init__(
        self,
        *,
        auto_start: bool = False,
        base_url: str = "http://localhost:5000",
    ) -> None:
        super().__init__(auto_start=auto_start)
        self.base_url = base_url
        self._loaded_model: Optional[str] = None
        self._client = httpx.AsyncClient(timeout=120.0)  # 2 minute timeout

    async def load_model(self, model: LocalModel) -> None:
        """Load a voice model into Piper runtime."""
        try:
            # Verify server is running and load voice
            model_name = model.name
            response = await self._client.post(
                f"{self.base_url}/load",
                json={"model": model_name},
            )
            response.raise_for_status()
            self._loaded_model = model_name
        except Exception as e:
            raise RuntimeError(f"Failed to load model {model.name} into Piper: {e}")

    async def get_status(self) -> ExecutorStatus:
        """Check if Piper service is running and healthy."""
        try:
            response = await self._client.get(f"{self.base_url}/voices")
            response.raise_for_status()
            voices = response.json().get("voices", [])
            return ExecutorStatus(
                name=self.name,
                is_running=True,
                healthy=True,
                detail={"available_voices": voices},
            )
        except Exception as e:
            return ExecutorStatus(
                name=self.name,
                is_running=False,
                healthy=False,
                detail={"reason": f"Cannot connect to Piper: {str(e)}"},
            )

    async def text_to_speech(self, params: dict[str, Any]) -> ExecutionResponse:
        """
        Synthesize speech using Piper.

        Expected params:
        - text: str (text to synthesize)
        - voice: str (voice/model name, optional if already loaded)
        - speaker: int (speaker ID for multi-speaker models, optional)
        - speed: float (speaking rate, default: 1.0)
        - format: str (audio format: 'wav', 'mp3', default: 'wav')
        """
        text = params.get("text", "")
        if not text:
            return ExecutionResponse(
                status="error",
                result={"error": "No text provided"},
            )

        voice = params.get("voice", self._loaded_model)
        if not voice:
            return ExecutionResponse(
                status="error",
                result={"error": "No voice specified or loaded"},
            )

        speaker = params.get("speaker")
        speed = params.get("speed", 1.0)
        audio_format = params.get("format", "wav")

        try:
            payload: dict[str, Any] = {
                "text": text,
                "voice": voice,
                "speed": speed,
                "format": audio_format,
            }

            if speaker is not None:
                payload["speaker"] = speaker

            response = await self._client.post(
                f"{self.base_url}/synthesize",
                json=payload,
            )
            response.raise_for_status()

            # Response should contain audio data
            if response.headers.get("content-type", "").startswith("audio/"):
                # Binary audio response
                audio_bytes = response.content
                audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
                return ExecutionResponse(
                    status="completed",
                    result={
                        "audio": audio_base64,
                        "format": audio_format,
                        "voice": voice,
                    },
                    metadata={
                        "text_length": len(text),
                        "speaker": speaker,
                        "speed": speed,
                    },
                )
            else:
                # JSON response with audio data
                data = response.json()
                return ExecutionResponse(
                    status="completed",
                    result={
                        "audio": data.get("audio"),
                        "format": audio_format,
                        "voice": voice,
                    },
                    metadata={
                        "text_length": len(text),
                        "speaker": speaker,
                        "speed": speed,
                        "duration": data.get("duration"),
                    },
                )
        except Exception as e:
            return ExecutionResponse(
                status="error",
                result={"error": str(e)},
            )

    async def execute(self, request: ExecutionRequest) -> ExecutionResponse:
        """Execute a text-to-speech request."""
        return await self.text_to_speech(request.parameters)

    async def unload_model(self, model_id: Any) -> None:
        """Unload a voice model from Piper."""
        self._loaded_model = None

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()
