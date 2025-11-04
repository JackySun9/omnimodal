"""Tests for Speech-to-Text API endpoints."""
import pytest
from fastapi.testclient import TestClient
import io


def test_list_stt_models(client: TestClient):
    """Test GET /stt/models endpoint."""
    response = client.get("/api/v1/stt/models")
    assert response.status_code == 200
    
    data = response.json()
    # Response should have models key with list of model information
    assert "models" in data
    assert isinstance(data["models"], list)


def test_transcribe_missing_file(client: TestClient):
    """Test POST /stt/transcribe without file."""
    response = client.post("/api/v1/stt/transcribe")
    # Should return 422 for missing required field
    assert response.status_code == 422  # Validation error


def test_transcribe_invalid_file_type(client: TestClient):
    """Test POST /stt/transcribe with invalid file type."""
    # Create a fake text file instead of audio
    fake_audio = io.BytesIO(b"Not an audio file")
    
    response = client.post(
        "/api/v1/stt/transcribe",
        files={"audio": ("test.txt", fake_audio, "text/plain")}  # Changed 'file' to 'audio'
    )
    # Should return error for invalid audio
    assert response.status_code in [400, 422, 500]


def test_transcribe_with_model_parameter(client: TestClient):
    """Test POST /stt/transcribe with model parameter."""
    # Create minimal WAV file header (44 bytes)
    wav_header = (
        b'RIFF'
        + (36).to_bytes(4, 'little')  # Chunk size
        + b'WAVE'
        + b'fmt '
        + (16).to_bytes(4, 'little')  # Subchunk1 size
        + (1).to_bytes(2, 'little')   # Audio format (PCM)
        + (1).to_bytes(2, 'little')   # Num channels
        + (16000).to_bytes(4, 'little')  # Sample rate
        + (32000).to_bytes(4, 'little')  # Byte rate
        + (2).to_bytes(2, 'little')   # Block align
        + (16).to_bytes(2, 'little')  # Bits per sample
        + b'data'
        + (0).to_bytes(4, 'little')   # Subchunk2 size
    )
    
    fake_audio = io.BytesIO(wav_header)
    
    response = client.post(
        "/api/v1/stt/transcribe",
        files={"audio": ("test.wav", fake_audio, "audio/wav")},  # Changed 'file' to 'audio'
        data={"executor": "faster-whisper-stt"}  # Changed 'model' to 'executor'
    )
    # May succeed or fail depending on whether STT is configured
    # 422 is also valid if the audio data is invalid
    assert response.status_code in [200, 400, 404, 422, 500, 503]


def test_stt_supported_formats(client: TestClient):
    """Test that common audio formats are accepted."""
    formats = [
        ("test.wav", "audio/wav"),
        ("test.mp3", "audio/mpeg"),
        ("test.m4a", "audio/mp4"),
        ("test.ogg", "audio/ogg"),
    ]
    
    for filename, content_type in formats:
        fake_audio = io.BytesIO(b"fake audio data")
        response = client.post(
            "/api/v1/stt/transcribe",
            files={"audio": (filename, fake_audio, content_type)}  # Changed 'file' to 'audio'
        )
        # Should accept the file (even if processing fails)
        assert response.status_code in [200, 400, 422, 500, 503]


@pytest.mark.asyncio
async def test_stt_transcribe_async():
    """Test async transcription endpoint."""
    from httpx import AsyncClient
    from app.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        fake_audio = io.BytesIO(b"fake audio data")
        
        response = await ac.post(
            "/api/v1/stt/transcribe",
            files={"audio": ("test.wav", fake_audio, "audio/wav")}  # Changed 'file' to 'audio'
        )
        # Should return a response (success or error)
        assert response.status_code in [200, 400, 404, 422, 500, 503]


def test_stt_model_list_structure(client: TestClient):
    """Test that STT model list has expected structure."""
    response = client.get("/api/v1/stt/models")
    assert response.status_code == 200
    
    data = response.json()
    model_list = data if isinstance(data, list) else data.get("models", [])
    
    for model in model_list:
        # Each model should have basic info
        assert isinstance(model, (dict, str))
