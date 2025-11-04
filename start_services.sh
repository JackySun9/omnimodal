#!/bin/bash
# Start all required services for the Unified Multimodal Platform

set -e

echo "🚀 Starting Unified Multimodal Platform Services..."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Ollama is running
echo -n "Checking Ollama... "
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${YELLOW}⚠ Not running${NC}"
    echo "Starting Ollama..."
    if command -v ollama &> /dev/null; then
        ollama serve > /tmp/ollama.log 2>&1 &
        sleep 2
        echo -e "${GREEN}✓ Ollama started${NC}"
    else
        echo -e "${RED}✗ Ollama not installed. Please install from https://ollama.ai${NC}"
        exit 1
    fi
fi

# Check if OllamaDiffuser is running
echo -n "Checking OllamaDiffuser... "
if curl -s http://localhost:11435/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${YELLOW}⚠ Not running${NC}"
    echo "Starting OllamaDiffuser..."
    # Use the installed ollamadiffuser with Python 3.10
    if [ -f ~/.pyenv/versions/3.10.0/bin/ollamadiffuser ]; then
        ~/.pyenv/versions/3.10.0/bin/ollamadiffuser serve --port 11435 > /tmp/ollama_diffuser.log 2>&1 &
    else
        echo -e "${RED}✗ ollamadiffuser not found. Install with: pip install ollamadiffuser${NC}"
        exit 1
    fi
    sleep 5
    if curl -s http://localhost:11435/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ OllamaDiffuser started${NC}"
    else
        echo -e "${RED}✗ Failed to start OllamaDiffuser. Check /tmp/ollama_diffuser.log${NC}"
        exit 1
    fi
fi

echo ""
echo "📊 Service Status:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get Ollama info
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    OLLAMA_MODELS=$(curl -s http://localhost:11434/api/tags | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('models', [])))" 2>/dev/null || echo "?")
    echo "  Ollama:         http://localhost:11434 ($OLLAMA_MODELS models)"
fi

# Get OllamaDiffuser info
if curl -s http://localhost:11435/api/health > /dev/null 2>&1; then
    DIFFUSER_INFO=$(curl -s http://localhost:11435/)
    DIFFUSER_MODELS=$(echo "$DIFFUSER_INFO" | python3 -c "import sys, json; print(json.load(sys.stdin).get('available_models', '?'))" 2>/dev/null || echo "?")
    DIFFUSER_DEVICE=$(echo "$DIFFUSER_INFO" | python3 -c "import sys, json; print(json.load(sys.stdin).get('device', '?'))" 2>/dev/null || echo "?")
    echo "  OllamaDiffuser: http://localhost:11435 ($DIFFUSER_MODELS models, $DIFFUSER_DEVICE)"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✨ All services are ready!"
echo ""
echo "Next steps:"
echo "  1. Start backend:  cd backend && uv run uvicorn app.main:app --reload"
echo "  2. Start frontend: cd frontend && pnpm dev:web"
echo "  3. Open browser:   http://localhost:5173"
echo ""
echo "Logs:"
echo "  Ollama:         /tmp/ollama.log"
echo "  OllamaDiffuser: /tmp/ollama_diffuser.log"
echo ""
