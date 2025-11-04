#!/bin/bash
# Test script for STT API

echo "==================================="
echo "Testing STT API"
echo "==================================="
echo

# Check if backend is running
echo "1. Checking backend health..."
curl -s http://localhost:8000/docs > /dev/null && echo "✅ Backend is running" || echo "❌ Backend is not running"
echo

# Check STT executors
echo "2. Checking STT executors..."
curl -s http://localhost:8000/api/v1/stt/executors | jq -r '.executors | to_entries[] | "\(.key): \(if .value.is_running then "✅ Running" else "⚠️  Not loaded (will auto-load on first use)" end)"'
echo

# Load the base model
echo "3. Loading 'base' model into faster-whisper-stt..."
response=$(curl -s -X POST "http://localhost:8000/api/v1/stt/load-model/faster-whisper-stt?model_size=base" -H "Content-Type: application/json")
echo "$response" | jq '.'
echo

# Wait a bit for model to load
echo "4. Waiting for model to load..."
sleep 3
echo

# Check executor status again
echo "5. Checking executor status after loading..."
curl -s http://localhost:8000/api/v1/stt/executors | jq '.executors."faster-whisper-stt"'
echo

# Test transcription
echo "6. Testing transcription with test audio..."
cd backend
if [ -f test_audio.wav ]; then
    response=$(curl -s -X POST "http://localhost:8000/api/v1/stt/transcribe" \
        -F "audio=@test_audio.wav" \
        -F "executor=faster-whisper-stt" \
        -F "language=en")
    
    echo "$response" | jq '.'
    
    if echo "$response" | jq -e '.text' > /dev/null 2>&1; then
        echo
        echo "✅ Transcription successful!"
        echo "Text: $(echo "$response" | jq -r '.text')"
    else
        echo
        echo "❌ Transcription failed"
        echo "Error: $(echo "$response" | jq -r '.detail // .error // "Unknown error"')"
    fi
else
    echo "❌ Test audio file not found"
fi
