from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.schemas.executors import ExecutionRequest, ExecutionResponse
from app.services.executor_service import ExecutorService

router = APIRouter()


class STTRequest(BaseModel):
    """Request model for speech-to-text transcription."""
    
    executor: Literal["whisper-stt", "faster-whisper-stt", "whispercpp-stt"] = Field(
        default="faster-whisper-stt",
        description="Which STT executor to use"
    )
    language: Optional[str] = Field(
        default=None,
        description="Language code (e.g., 'en', 'es', 'fr') or None for auto-detect"
    )
    task: Literal["transcribe", "translate"] = Field(
        default="transcribe",
        description="'transcribe' for same language, 'translate' for English translation"
    )
    temperature: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Sampling temperature (0.0 for deterministic)"
    )
    word_timestamps: bool = Field(
        default=False,
        description="Include word-level timestamps"
    )
    initial_prompt: Optional[str] = Field(
        default=None,
        description="Optional text to guide the transcription style"
    )
    
    # Faster-Whisper specific options
    vad_filter: bool = Field(
        default=False,
        description="Use Voice Activity Detection (faster-whisper only)"
    )
    beam_size: int = Field(
        default=5,
        ge=1,
        description="Beam size for decoding (faster-whisper only)"
    )


class STTResponse(BaseModel):
    """Response model for speech-to-text transcription."""
    
    text: str = Field(description="Full transcribed text")
    language: Optional[str] = Field(description="Detected or specified language")
    segments: list[dict] = Field(default_factory=list, description="Text segments with timestamps")
    metadata: dict = Field(default_factory=dict, description="Additional metadata")


@router.post("/transcribe", response_model=STTResponse)
async def transcribe_audio(
    audio: UploadFile = File(..., description="Audio file to transcribe"),
    executor: str = Form("faster-whisper-stt"),
    language: Optional[str] = Form(None),
    task: str = Form("transcribe"),
    temperature: float = Form(0.0),
    word_timestamps: bool = Form(False),
    initial_prompt: Optional[str] = Form(None),
    vad_filter: bool = Form(False),
    beam_size: int = Form(5),
) -> STTResponse:
    """
    Transcribe audio file to text.
    
    Supports multiple STT backends:
    - **faster-whisper-stt**: Optimized Whisper (recommended, 4x faster)
    - **whisper-stt**: OpenAI Whisper (original implementation)
    - **whispercpp-stt**: whisper.cpp server (external service)
    
    Example:
    ```bash
    curl -X POST "http://localhost:8000/api/v1/stt/transcribe" \\
         -F "audio=@recording.wav" \\
         -F "executor=faster-whisper-stt" \\
         -F "language=en" \\
         -F "word_timestamps=true"
    ```
    """
    # Validate executor
    valid_executors = ["whisper-stt", "faster-whisper-stt", "whispercpp-stt"]
    if executor not in valid_executors:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid executor. Must be one of: {', '.join(valid_executors)}"
        )
    
    # Read audio file
    try:
        audio_data = await audio.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read audio file: {e}")
    
    # Prepare parameters
    params = {
        "audio_data": audio_data,
        "language": language,
        "task": task,
        "temperature": temperature,
        "word_timestamps": word_timestamps,
        "initial_prompt": initial_prompt,
    }
    
    # Add faster-whisper specific parameters
    if executor == "faster-whisper-stt":
        params["vad_filter"] = vad_filter
        params["beam_size"] = beam_size
    
    # Execute transcription
    service = ExecutorService()
    request = ExecutionRequest(parameters=params)
    
    try:
        response = await service.execute(executor, request)
        
        if response.status == "error":
            raise HTTPException(
                status_code=500,
                detail=response.result.get("error", "Transcription failed")
            )
        
        return STTResponse(
            text=response.result.get("text", ""),
            language=response.result.get("language"),
            segments=response.result.get("segments", []),
            metadata=response.metadata,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/executors")
async def list_stt_executors():
    """
    List available STT executors and their status.
    
    Returns information about all registered STT executors including:
    - Name and runtime
    - Health status
    - Device and configuration
    """
    service = ExecutorService()
    
    executors = ["whisper-stt", "faster-whisper-stt", "whispercpp-stt"]
    results = {}
    
    for executor_name in executors:
        status_response = await service.get_status(executor_name)
        if status_response:
            results[executor_name] = status_response.executor.model_dump()
    
    return {
        "executors": results,
        "recommended": "faster-whisper-stt",
        "description": {
            "whisper-stt": "OpenAI Whisper (original, GPU recommended)",
            "faster-whisper-stt": "Faster-Whisper (optimized, 4x faster, lower memory)",
            "whispercpp-stt": "whisper.cpp (external server, requires separate setup)",
        }
    }


@router.post("/load-model/{executor_name}")
async def load_stt_model(
    executor_name: str,
    model_size: Literal["tiny", "base", "small", "medium", "large", "large-v2", "large-v3"] = "base"
):
    """
    Load a specific Whisper model into an executor.
    
    Model sizes (from smallest to largest):
    - **tiny**: ~39M params, ~1GB RAM, fastest
    - **base**: ~74M params, ~1GB RAM
    - **small**: ~244M params, ~2GB RAM
    - **medium**: ~769M params, ~5GB RAM
    - **large**: ~1550M params, ~10GB RAM (most accurate)
    - **large-v2**: Improved large model
    - **large-v3**: Latest large model
    """
    service = ExecutorService()
    
    try:
        result = await service.load_model(executor_name, model_size)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models")
async def list_available_models():
    """
    List available Whisper model sizes and their requirements.
    """
    return {
        "models": [
            {
                "name": "tiny",
                "params": "39M",
                "vram": "~1GB",
                "speed": "~32x realtime",
                "use_case": "Very fast, basic accuracy"
            },
            {
                "name": "base",
                "params": "74M",
                "vram": "~1GB",
                "speed": "~16x realtime",
                "use_case": "Good balance of speed and accuracy"
            },
            {
                "name": "small",
                "params": "244M",
                "vram": "~2GB",
                "speed": "~6x realtime",
                "use_case": "Better accuracy, still fast"
            },
            {
                "name": "medium",
                "params": "769M",
                "vram": "~5GB",
                "speed": "~2x realtime",
                "use_case": "High accuracy for most languages"
            },
            {
                "name": "large",
                "params": "1550M",
                "vram": "~10GB",
                "speed": "~1x realtime",
                "use_case": "Best accuracy, resource intensive"
            },
            {
                "name": "large-v2",
                "params": "1550M",
                "vram": "~10GB",
                "speed": "~1x realtime",
                "use_case": "Improved large model"
            },
            {
                "name": "large-v3",
                "params": "1550M",
                "vram": "~10GB",
                "speed": "~1x realtime",
                "use_case": "Latest and most accurate"
            }
        ],
        "recommendation": "Use 'base' for CPU, 'small' or 'medium' for GPU"
    }
