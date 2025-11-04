#!/bin/bash
# Test script for Image Generation API

echo "==================================="
echo "Testing Image Generation API"
echo "==================================="
echo

# Check if OllamaDiffuser is running
echo "1. Checking OllamaDiffuser health..."
health=$(curl -s http://localhost:11435/api/health)
echo "$health" | jq '.'
status=$(echo "$health" | jq -r '.status')
if [ "$status" = "healthy" ]; then
    echo "✅ OllamaDiffuser is healthy"
else
    echo "❌ OllamaDiffuser is not healthy"
    exit 1
fi
echo

# Check available models
echo "2. Checking available models..."
models=$(curl -s http://localhost:11435/api/models)
installed_count=$(echo "$models" | jq -r '.installed | length')
echo "Installed models: $installed_count"
echo "$models" | jq -r '.installed | .[] | "  - \(.)"' | head -10
echo

# Pick a fast model (Q2K quantization is fastest)
echo "3. Selecting model for testing..."
model="flux.1-schnell-gguf-q2k"
if echo "$models" | jq -r '.installed[]' | grep -q "$model"; then
    echo "✅ Using model: $model"
else
    # Try alternative
    model="stable-diffusion-1.5"
    if echo "$models" | jq -r '.installed[]' | grep -q "$model"; then
        echo "✅ Using model: $model"
    else
        echo "⚠️ No suitable fast model found, using first available"
        model=$(echo "$models" | jq -r '.installed[0]')
        echo "Using: $model"
    fi
fi
echo

# Load the model
echo "4. Loading model into OllamaDiffuser..."
load_response=$(curl -s -X POST http://localhost:11435/api/models/load \
    -H "Content-Type: application/json" \
    -d "{\"model_name\": \"$model\"}")
echo "$load_response" | jq '.'
echo

# Wait for model to load
echo "5. Waiting for model to load..."
sleep 3
echo

# Check health again to confirm model is loaded
echo "6. Checking if model is loaded..."
health=$(curl -s http://localhost:11435/api/health)
echo "$health" | jq '.'
current_model=$(echo "$health" | jq -r '.current_model')
model_loaded=$(echo "$health" | jq -r '.model_loaded')

if [ "$model_loaded" = "true" ]; then
    echo "✅ Model loaded: $current_model"
else
    echo "❌ Model failed to load"
    exit 1
fi
echo

# Generate a test image
echo "7. Generating test image..."
echo "Prompt: 'A cute cat'"
echo "This may take 10-60 seconds depending on model and hardware..."
echo

gen_response=$(curl -s -X POST http://localhost:11435/api/generate \
    -H "Content-Type: application/json" \
    -d '{
        "prompt": "A cute cat",
        "width": 512,
        "height": 512,
        "steps": 4,
        "guidance_scale": 0
    }' \
    --max-time 120)

# Check if response is binary (image data) or JSON (error)
if echo "$gen_response" | jq -e '.' > /dev/null 2>&1; then
    # It's JSON (probably an error)
    echo "Response:"
    echo "$gen_response" | jq '.'
else
    # It's binary data (image)
    size=$(echo -n "$gen_response" | wc -c)
    if [ "$size" -gt 1000 ]; then
        echo "✅ Image generated successfully!"
        echo "   Size: $size bytes"
        echo "   Saving to test_generated_image.png..."
        echo -n "$gen_response" > test_generated_image.png
        echo "   Saved!"
        
        if command -v file > /dev/null; then
            file_type=$(file test_generated_image.png)
            echo "   Type: $file_type"
        fi
    else
        echo "❌ Generated data too small to be an image"
        echo "Response: $gen_response"
    fi
fi
echo

echo "==================================="
echo "Image Generation Test Complete"
echo "==================================="
