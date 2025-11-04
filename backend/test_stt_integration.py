#!/usr/bin/env python3
"""
Example script demonstrating Whisper & Faster-Whisper STT integration.

This script shows how to use the STT executors programmatically.
"""

import asyncio
from pathlib import Path

from app.executors.audio.stt_whisper import WhisperSTTExecutor
from app.executors.audio.stt_faster_whisper import FasterWhisperSTTExecutor
from app.schemas.executors import ExecutionRequest
from app.schemas.models import LocalModel


async def test_whisper_executor():
    """Test OpenAI Whisper executor."""
    print("=" * 60)
    print("Testing OpenAI Whisper Executor")
    print("=" * 60)
    
    executor = WhisperSTTExecutor(device="cpu")  # Use CPU for testing
    
    # Check status
    status = await executor.get_status()
    print(f"\nStatus: {status.model_dump_json(indent=2)}")
    
    # Load model
    print("\nLoading 'base' model...")
    model = LocalModel(name="base", path=None, modality="stt")
    try:
        await executor.load_model(model)
        print("✓ Model loaded successfully")
    except Exception as e:
        print(f"✗ Failed to load model: {e}")
        return
    
    # Example: transcribe audio file (if exists)
    test_audio = Path("test_audio.wav")
    if test_audio.exists():
        print(f"\nTranscribing {test_audio}...")
        with open(test_audio, "rb") as f:
            audio_data = f.read()
        
        request = ExecutionRequest(parameters={
            "audio_data": audio_data,
            "language": "en",
            "temperature": 0.0,
            "word_timestamps": False,
        })
        
        response = await executor.execute(request)
        print(f"\nResponse: {response.model_dump_json(indent=2)}")
    else:
        print(f"\n⚠ No test audio file found at {test_audio}")
        print("To test transcription, place a WAV file at 'test_audio.wav'")
    
    # Cleanup
    await executor.close()
    print("\n✓ Executor closed")


async def test_faster_whisper_executor():
    """Test Faster-Whisper executor."""
    print("\n" + "=" * 60)
    print("Testing Faster-Whisper Executor")
    print("=" * 60)
    
    executor = FasterWhisperSTTExecutor(
        device="cpu",
        compute_type="int8",  # Use int8 for CPU
        cpu_threads=4,
    )
    
    # Check status
    status = await executor.get_status()
    print(f"\nStatus: {status.model_dump_json(indent=2)}")
    
    # Load model
    print("\nLoading 'base' model...")
    model = LocalModel(name="base", path=None, modality="stt")
    try:
        await executor.load_model(model)
        print("✓ Model loaded successfully")
    except Exception as e:
        print(f"✗ Failed to load model: {e}")
        return
    
    # Example: transcribe audio file (if exists)
    test_audio = Path("test_audio.wav")
    if test_audio.exists():
        print(f"\nTranscribing {test_audio}...")
        with open(test_audio, "rb") as f:
            audio_data = f.read()
        
        request = ExecutionRequest(parameters={
            "audio_data": audio_data,
            "language": "en",
            "temperature": 0.0,
            "word_timestamps": True,
            "vad_filter": True,  # Enable VAD
            "beam_size": 5,
        })
        
        response = await executor.execute(request)
        print(f"\nResponse: {response.model_dump_json(indent=2)}")
    else:
        print(f"\n⚠ No test audio file found at {test_audio}")
        print("To test transcription, place a WAV file at 'test_audio.wav'")
    
    # Cleanup
    await executor.close()
    print("\n✓ Executor closed")


async def compare_executors():
    """Compare performance between executors."""
    print("\n" + "=" * 60)
    print("Comparing Executor Performance")
    print("=" * 60)
    
    test_audio = Path("test_audio.wav")
    if not test_audio.exists():
        print(f"\n⚠ No test audio file found at {test_audio}")
        print("Create a test audio file to compare performance")
        return
    
    with open(test_audio, "rb") as f:
        audio_data = f.read()
    
    request = ExecutionRequest(parameters={
        "audio_data": audio_data,
        "language": "en",
        "temperature": 0.0,
    })
    
    # Test Whisper
    print("\n1. OpenAI Whisper...")
    whisper_executor = WhisperSTTExecutor(device="cpu")
    model = LocalModel(name="base", path=None, modality="stt")
    await whisper_executor.load_model(model)
    
    import time
    start = time.time()
    whisper_response = await whisper_executor.execute(request)
    whisper_time = time.time() - start
    
    print(f"   Time: {whisper_time:.2f}s")
    print(f"   Text length: {len(whisper_response.result.get('text', ''))}")
    await whisper_executor.close()
    
    # Test Faster-Whisper
    print("\n2. Faster-Whisper...")
    faster_executor = FasterWhisperSTTExecutor(device="cpu", compute_type="int8")
    await faster_executor.load_model(model)
    
    start = time.time()
    faster_response = await faster_executor.execute(request)
    faster_time = time.time() - start
    
    print(f"   Time: {faster_time:.2f}s")
    print(f"   Text length: {len(faster_response.result.get('text', ''))}")
    await faster_executor.close()
    
    # Compare
    print("\n" + "-" * 60)
    print(f"Speedup: {whisper_time / faster_time:.2f}x faster with Faster-Whisper")
    print("-" * 60)


async def main():
    """Run all tests."""
    print("\n🎤 Whisper & Faster-Whisper STT Integration Test\n")
    
    try:
        # Test OpenAI Whisper
        await test_whisper_executor()
        
        # Test Faster-Whisper
        await test_faster_whisper_executor()
        
        # Compare performance
        await compare_executors()
        
    except KeyboardInterrupt:
        print("\n\n⚠ Interrupted by user")
    except Exception as e:
        print(f"\n\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n✓ All tests completed!\n")


if __name__ == "__main__":
    asyncio.run(main())
