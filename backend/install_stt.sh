#!/bin/bash
# Installation script for Whisper & Faster-Whisper STT integration

set -e

echo "🎤 Installing Whisper & Faster-Whisper STT Integration"
echo "======================================================="
echo ""

# Check if we're in the backend directory
if [ ! -f "pyproject.toml" ]; then
    echo "❌ Error: Not in backend directory"
    echo "Please run: cd backend && ./install_stt.sh"
    exit 1
fi

# Install dependencies using uv
echo "📦 Installing dependencies with uv..."
uv sync

echo ""
echo "✅ Installation complete!"
echo ""
echo "🚀 Next steps:"
echo ""
echo "1. Start the backend server:"
echo "   uv run uvicorn app.main:app --reload"
echo ""
echo "2. Visit the API docs:"
echo "   http://localhost:8000/docs"
echo ""
echo "3. Test STT endpoints:"
echo "   curl -X POST \"http://localhost:8000/api/v1/stt/transcribe\" \\"
echo "        -F \"audio=@test.wav\" \\"
echo "        -F \"executor=faster-whisper-stt\""
echo ""
echo "4. Run the test script:"
echo "   uv run python test_stt_integration.py"
echo ""
echo "📚 Documentation:"
echo "   - WHISPER_STT_INTEGRATION.md (comprehensive guide)"
echo "   - STT_INTEGRATION_SUMMARY.md (quick reference)"
echo ""
echo "💡 Tips:"
echo "   - First transcription will download the model (~150MB for base)"
echo "   - Use 'faster-whisper-stt' executor (recommended, 4x faster)"
echo "   - Enable VAD filtering for better performance"
echo "   - Use int8 compute type for CPU: device='cpu', compute_type='int8'"
echo ""
