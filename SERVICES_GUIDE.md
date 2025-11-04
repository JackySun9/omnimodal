# 🎯 Services Guide - Unified Multimodal Platform

This guide explains how to manage the services required for the platform.

## 📋 Required Services

The platform requires two external services for AI model execution:

### 1. **Ollama** (Text Models)
- **Port**: 11434
- **Purpose**: Run LLM text models (Llama, Mistral, DeepSeek, etc.)
- **Website**: https://ollama.ai
- **Status**: ✅ Already installed and running

### 2. **OllamaDiffuser** (Image Models)
- **Port**: 11435
- **Purpose**: Run image generation models (Flux, Stable Diffusion, etc.)
- **Implementation**: Custom Python server (`ollama_diffuser_server.py`)
- **Device**: Apple Silicon (MPS acceleration)
- **Status**: ✅ Now running

---

## 🚀 Quick Start

### Start All Services
```bash
./start_services.sh
```

This script will:
- ✅ Check if Ollama is running (start if needed)
- ✅ Check if OllamaDiffuser is running (start if needed)
- ✅ Display service status and model counts

### Stop Services
```bash
./stop_services.sh
```

### Check Status
```bash
# Ollama
curl http://localhost:11434/api/tags

# OllamaDiffuser
curl http://localhost:11435/api/health
curl http://localhost:11435/api/models
```

---

## 📦 Your Available Models

### Text Models (Ollama) - 7 models
Check with: `ollama list`

### Image Models (OllamaDiffuser) - 24 models
```
Flux Models:
  - flux.1-dev (23GB, high quality)
  - flux.1-schnell (23GB, fast generation)
  - flux.1-dev-gguf-q2k (quantized, smaller)
  - flux.1-dev-gguf-q3ks
  - flux.1-dev-gguf-q4-1
  - flux.1-dev-gguf-q4ks (recommended balance)
  - flux.1-dev-gguf-q8 (high quality quantized)
  - flux.1-schnell-gguf-q2k
  - flux.1-schnell-gguf-q3ks
  - flux.1-schnell-gguf-q4ks
  - flux.1-schnell-gguf-q8

Stable Diffusion Models:
  - stable-diffusion-1.5
  - stable-diffusion-3.5-large-q4-0
  - stable-diffusion-3.5-large-q4-1
  - stable-diffusion-3.5-large-q5-0
  - stable-diffusion-3.5-large-turbo-q4-0
  - stable-diffusion-3.5-large-turbo-q4-1
  - stable-diffusion-3.5-large-turbo-q5-0
  - stable-diffusion-3.5-medium

ControlNet Models:
  - controlnet-canny-sd15
  - controlnet-canny-sdxl
  - controlnet-depth-sd15
```

**Total**: ~200GB+ of models ready to use!

---

## 🔧 Manual Service Management

### Start Ollama (if not running)
```bash
# On macOS (usually runs automatically)
ollama serve

# Or if installed via Homebrew
brew services start ollama
```

### Start OllamaDiffuser
```bash
# From project root
python3 ollama_diffuser_server.py

# Or run in background
nohup python3 ollama_diffuser_server.py > /tmp/ollama_diffuser.log 2>&1 &
```

### Stop OllamaDiffuser
```bash
pkill -f ollama_diffuser_server
```

---

## 🐛 Troubleshooting

### "Cannot connect to Ollama"
**Check 1: Is it running?**
```bash
ps aux | grep "ollama serve"
```

**Check 2: Try starting it**
```bash
ollama serve
```

**Check 3: Test connection**
```bash
curl http://localhost:11434/api/tags
```

### "Cannot connect to OllamaDiffuser"
**Check 1: Is it running?**
```bash
ps aux | grep ollama_diffuser_server
```

**Check 2: Check logs**
```bash
tail -f /tmp/ollama_diffuser.log
```

**Check 3: Start manually**
```bash
cd /path/to/unified-multimodal-platform
python3 ollama_diffuser_server.py
```

**Check 4: Verify Python packages**
```bash
python3 -m pip list | grep -E "torch|diffusers|fastapi"
```

### Port Already in Use
**Check what's using the port:**
```bash
lsof -i :11435  # For OllamaDiffuser
lsof -i :11434  # For Ollama
```

**Kill the process:**
```bash
kill -9 <PID>
```

### OllamaDiffuser Crashes on Model Load
**Issue**: Out of memory when loading large models

**Solutions:**
1. Use quantized models (q4ks recommended)
2. Close other applications
3. Use smaller models like `flux.1-schnell-gguf-q2k`
4. Reduce image dimensions (512x512 instead of 1024x1024)

**Check available memory:**
```bash
vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//' | awk '{print $1 * 4096 / 1024 / 1024 " MB"}'
```

### Image Generation is Slow
**Optimization tips:**

1. **Use faster models**: `flux.1-schnell` (optimized for speed)
2. **Use quantized models**: `flux.1-schnell-gguf-q4ks`
3. **Reduce steps**: 10-15 instead of 28
4. **Reduce dimensions**: 768x768 or 512x512
5. **First generation is slowest** (model loading, ~30-60s)
6. **Subsequent generations are faster** (model cached, ~10-20s)

---

## 📊 Service Endpoints

### Ollama (Port 11434)
- `GET /api/tags` - List models
- `POST /api/generate` - Generate text
- `POST /api/chat` - Chat completion
- `POST /api/pull` - Download models

### OllamaDiffuser (Port 11435)
- `GET /api/health` - Health check
- `GET /api/models` - List available models
- `GET /api/tags` - List models (Ollama-compatible)
- `POST /api/models/load` - Load a model
- `POST /api/generate` - Generate image
- `POST /api/pull` - Verify model exists

---

## 🎨 Testing Image Generation

### Quick Test via CLI
```bash
# 1. Load a model
curl -X POST http://localhost:11435/api/models/load \
  -H "Content-Type: application/json" \
  -d '{"model_name": "flux.1-schnell-gguf-q4ks"}'

# 2. Generate an image
curl -X POST http://localhost:11435/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A serene mountain landscape at sunset",
    "negative_prompt": "low quality, bad anatomy",
    "width": 768,
    "height": 768,
    "steps": 15,
    "guidance_scale": 3.5
  }' \
  --output test_image.png

# 3. View the image
open test_image.png  # macOS
```

### Expected Times (Apple Silicon)
- **First generation**: 30-60 seconds (model loading)
- **Subsequent**: 10-30 seconds (model cached)
- **Quantized models**: Faster (q2k fastest, q8 slowest but better quality)

---

## 🔄 Auto-Start on Boot (Optional)

### macOS LaunchAgent for OllamaDiffuser

Create `~/Library/LaunchAgents/com.user.ollamadiffuser.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.user.ollamadiffuser</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/python3</string>
        <string>/path/to/unified-multimodal-platform/ollama_diffuser_server.py</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/ollama_diffuser.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/ollama_diffuser_error.log</string>
</dict>
</plist>
```

Load it:
```bash
launchctl load ~/Library/LaunchAgents/com.user.ollamadiffuser.plist
```

---

## 📈 Monitoring

### Watch Service Logs
```bash
# OllamaDiffuser
tail -f /tmp/ollama_diffuser.log

# Ollama (if logging enabled)
tail -f /tmp/ollama.log
```

### Resource Usage
```bash
# CPU and Memory
ps aux | grep -E "ollama|python3.*ollama_diffuser"

# GPU (Metal) usage on macOS
sudo powermetrics --samplers gpu_power -i 1000 -n 1
```

---

## 🎯 Integration with Platform

The platform automatically connects to these services when they're running:

1. **Backend** (`app/executors/`) detects services on startup
2. **Frontend** displays service status in Models page
3. **Automatic retries** if services are temporarily unavailable
4. **Health checks** every 30 seconds

No configuration needed - just make sure services are running!

---

## 📚 Additional Resources

- **Ollama**: https://ollama.ai
- **Diffusers Library**: https://huggingface.co/docs/diffusers
- **Flux Models**: https://huggingface.co/black-forest-labs
- **Stable Diffusion**: https://stability.ai

---

## ✅ Current Status

```bash
$ ./start_services.sh

🚀 Starting Unified Multimodal Platform Services...

Checking Ollama... ✓ Running
Checking OllamaDiffuser... ✓ Running

📊 Service Status:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Ollama:         http://localhost:11434 (7 models)
  OllamaDiffuser: http://localhost:11435 (24 models, mps)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ All services are ready!
```

**You're all set!** 🎉
