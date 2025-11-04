#!/bin/bash
# Stop all services for the Unified Multimodal Platform

echo "🛑 Stopping Unified Multimodal Platform Services..."
echo ""

# Stop OllamaDiffuser
echo -n "Stopping OllamaDiffuser... "
if ~/.pyenv/versions/3.10.0/bin/ollamadiffuser stop 2>/dev/null; then
    echo "✓"
else
    pkill -f "ollamadiffuser serve" && echo "✓" || echo "✗ (not running)"
fi

# Note: We don't stop Ollama as it's a system service that may be used by other apps
echo ""
echo "Note: Ollama service left running (system service)"
echo "      To stop Ollama: pkill -f 'ollama serve'"
echo ""
echo "Done!"
