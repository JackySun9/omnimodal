#!/usr/bin/env python3
"""
Quick start guide for Whisper & Faster-Whisper STT integration.

This script demonstrates the three available STT executors and basic usage.
"""

import asyncio
import sys
from pathlib import Path


async def check_installation():
    """Check if required packages are installed."""
    print("🔍 Checking installation...\n")
    
    # Check whisper
    try:
        import whisper
        print(f"✅ OpenAI Whisper: {whisper.__version__ if hasattr(whisper, '__version__') else 'installed'}")
    except ImportError:
        print("❌ OpenAI Whisper not installed")
        print("   Run: uv sync")
        return False
    
    # Check faster-whisper
    try:
        import faster_whisper
        print(f"✅ Faster-Whisper: {faster_whisper.__version__ if hasattr(faster_whisper, '__version__') else 'installed'}")
    except ImportError:
        print("❌ Faster-Whisper not installed")
        print("   Run: uv sync")
        return False
    
    # Check torch
    try:
        import torch
        print(f"✅ PyTorch: {torch.__version__}")
        print(f"   CUDA available: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            print(f"   GPU: {torch.cuda.get_device_name(0)}")
    except ImportError:
        print("❌ PyTorch not installed")
        print("   Run: uv sync")
        return False
    
    print("\n✅ All dependencies installed!\n")
    return True


async def demo_faster_whisper():
    """Demonstrate Faster-Whisper executor."""
    print("=" * 70)
    print("DEMO 1: Faster-Whisper (Recommended)")
    print("=" * 70)
    print()
    print("Features:")
    print("  - 4x faster than OpenAI Whisper")
    print("  - Lower memory usage")
    print("  - int8 quantization support")
    print("  - Voice Activity Detection (VAD)")
    print("  - Best for production use")
    print()
    
    from app.executors.audio.stt_faster_whisper import FasterWhisperSTTExecutor
    from app.schemas.models import LocalModel
    
    # Initialize
    print("🔧 Initializing Faster-Whisper executor...")
    executor = FasterWhisperSTTExecutor(
        device="cpu",           # Use CPU for demo (change to "cuda" if GPU available)
        compute_type="int8",    # Use int8 for faster CPU inference
        cpu_threads=4,
    )
    
    # Check status
    status = await executor.get_status()
    print(f"📊 Status:")
    print(f"   Running: {status.is_running}")
    print(f"   Device: {status.detail.get('device')}")
    print(f"   Compute Type: {status.detail.get('compute_type')}")
    print()
    
    # Load model
    print("📥 Loading 'tiny' model (fastest for demo)...")
    model = LocalModel(name="tiny", path=None, modality="stt")
    try:
        await executor.load_model(model)
        print("✅ Model loaded!\n")
    except Exception as e:
        print(f"❌ Failed to load model: {e}\n")
        return
    
    print("💡 Usage Example:")
    print("""
    from app.executors.audio.stt_faster_whisper import FasterWhisperSTTExecutor
    from app.schemas.executors import ExecutionRequest
    
    executor = FasterWhisperSTTExecutor(device="cpu", compute_type="int8")
    
    # Transcribe audio file
    with open("audio.wav", "rb") as f:
        request = ExecutionRequest(parameters={
            "audio_data": f.read(),
            "language": "en",
            "word_timestamps": True,
            "vad_filter": True,
        })
    
    response = await executor.execute(request)
    print(response.result["text"])
    """)
    
    await executor.close()
    print()


async def demo_openai_whisper():
    """Demonstrate OpenAI Whisper executor."""
    print("=" * 70)
    print("DEMO 2: OpenAI Whisper (Original)")
    print("=" * 70)
    print()
    print("Features:")
    print("  - Original OpenAI implementation")
    print("  - Maximum compatibility")
    print("  - Supports CUDA and Apple Silicon (MPS)")
    print("  - Good for development and testing")
    print()
    
    from app.executors.audio.stt_whisper import WhisperSTTExecutor
    from app.schemas.models import LocalModel
    
    # Initialize
    print("🔧 Initializing OpenAI Whisper executor...")
    executor = WhisperSTTExecutor(device="cpu")  # Auto-detects best device
    
    # Check status
    status = await executor.get_status()
    print(f"📊 Status:")
    print(f"   Running: {status.is_running}")
    print(f"   Device: {status.detail.get('device')}")
    print(f"   CUDA Available: {status.detail.get('cuda_available')}")
    print(f"   MPS Available: {status.detail.get('mps_available')}")
    print()
    
    # Load model
    print("📥 Loading 'tiny' model (fastest for demo)...")
    model = LocalModel(name="tiny", path=None, modality="stt")
    try:
        await executor.load_model(model)
        print("✅ Model loaded!\n")
    except Exception as e:
        print(f"❌ Failed to load model: {e}\n")
        return
    
    print("💡 Usage Example:")
    print("""
    from app.executors.audio.stt_whisper import WhisperSTTExecutor
    from app.schemas.executors import ExecutionRequest
    
    executor = WhisperSTTExecutor(device="cuda")  # or "cpu" or "mps"
    
    # Transcribe with word timestamps
    with open("audio.wav", "rb") as f:
        request = ExecutionRequest(parameters={
            "audio_data": f.read(),
            "language": "en",
            "word_timestamps": True,
            "temperature": 0.0,
        })
    
    response = await executor.execute(request)
    print(response.result["text"])
    """)
    
    await executor.close()
    print()


async def demo_api_usage():
    """Demonstrate API usage."""
    print("=" * 70)
    print("DEMO 3: REST API Usage")
    print("=" * 70)
    print()
    print("The STT executors are exposed via REST API endpoints.")
    print()
    
    print("📍 Available Endpoints:")
    print()
    print("1. POST /api/v1/stt/transcribe")
    print("   - Transcribe audio file")
    print("   - Supports multiple executors")
    print()
    print("2. GET /api/v1/stt/executors")
    print("   - List available STT executors")
    print("   - Check status and capabilities")
    print()
    print("3. POST /api/v1/stt/load-model/{executor_name}")
    print("   - Pre-load a specific model")
    print()
    print("4. GET /api/v1/stt/models")
    print("   - List available model sizes")
    print()
    
    print("💡 Example API Calls:")
    print()
    print("# Basic transcription")
    print('curl -X POST "http://localhost:8000/api/v1/stt/transcribe" \\')
    print('     -F "audio=@recording.wav" \\')
    print('     -F "executor=faster-whisper-stt"')
    print()
    print("# With word timestamps and VAD")
    print('curl -X POST "http://localhost:8000/api/v1/stt/transcribe" \\')
    print('     -F "audio=@meeting.wav" \\')
    print('     -F "executor=faster-whisper-stt" \\')
    print('     -F "word_timestamps=true" \\')
    print('     -F "vad_filter=true"')
    print()
    print("# List executors")
    print('curl http://localhost:8000/api/v1/stt/executors')
    print()
    print("# View API documentation")
    print("open http://localhost:8000/docs")
    print()


async def main():
    """Run all demos."""
    print()
    print("🎤 Whisper & Faster-Whisper STT Integration")
    print("=" * 70)
    print()
    
    # Check installation
    if not await check_installation():
        print("\n❌ Please install dependencies first:")
        print("   cd backend && uv sync\n")
        sys.exit(1)
    
    try:
        # Demo 1: Faster-Whisper
        await demo_faster_whisper()
        
        # Demo 2: OpenAI Whisper
        await demo_openai_whisper()
        
        # Demo 3: API Usage
        await demo_api_usage()
        
        # Final instructions
        print("=" * 70)
        print("🎉 Quick Start Complete!")
        print("=" * 70)
        print()
        print("Next Steps:")
        print()
        print("1. Start the backend server:")
        print("   cd backend")
        print("   uv run uvicorn app.main:app --reload")
        print()
        print("2. Visit the interactive API docs:")
        print("   http://localhost:8000/docs")
        print()
        print("3. Try transcribing an audio file:")
        print("   - Go to /api/v1/stt/transcribe endpoint")
        print("   - Upload your audio file")
        print("   - Select executor: faster-whisper-stt (recommended)")
        print("   - Click 'Execute'")
        print()
        print("📚 Documentation:")
        print("   - WHISPER_STT_INTEGRATION.md (comprehensive guide)")
        print("   - STT_INTEGRATION_SUMMARY.md (quick reference)")
        print()
        print("💡 Recommendations:")
        print("   - Use 'faster-whisper-stt' for best performance")
        print("   - Enable 'vad_filter' to skip silence")
        print("   - Use 'base' model for CPU, 'medium' for GPU")
        print("   - Set compute_type='int8' for CPU usage")
        print()
        
    except KeyboardInterrupt:
        print("\n\n⚠️ Interrupted by user\n")
    except Exception as e:
        print(f"\n\n❌ Error: {e}\n")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
