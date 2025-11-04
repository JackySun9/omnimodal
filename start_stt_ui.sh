#!/bin/bash
# Quick Start Guide for STT UI

echo "🎤 STT UI Quick Start Guide"
echo "============================"
echo ""

# Check if in root directory
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "📋 Prerequisites Check:"
echo ""

# Check Python/uv
if command -v uv &> /dev/null; then
    echo "✅ uv installed"
else
    echo "❌ uv not found. Install: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Check Node/pnpm
if command -v pnpm &> /dev/null; then
    echo "✅ pnpm installed"
else
    echo "❌ pnpm not found. Install: npm install -g pnpm"
    exit 1
fi

echo ""
echo "🚀 Starting Services..."
echo ""

# Function to start backend
start_backend() {
    echo "📦 Starting Backend..."
    cd backend
    
    # Install dependencies if needed
    if [ ! -d ".venv" ]; then
        echo "Installing backend dependencies..."
        uv sync
    fi
    
    # Start server
    echo "Starting FastAPI server on http://localhost:8000"
    uv run uvicorn app.main:app --reload &
    BACKEND_PID=$!
    echo "Backend PID: $BACKEND_PID"
    
    cd ..
}

# Function to start frontend
start_frontend() {
    echo "🎨 Starting Frontend..."
    cd frontend
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing frontend dependencies..."
        pnpm install
    fi
    
    # Start dev server
    echo "Starting Vite dev server on http://localhost:1420"
    pnpm dev &
    FRONTEND_PID=$!
    echo "Frontend PID: $FRONTEND_PID"
    
    cd ..
}

# Start services
start_backend
sleep 5  # Wait for backend to start
start_frontend

echo ""
echo "✅ Services Started!"
echo ""
echo "📍 URLs:"
echo "   Backend API: http://localhost:8000"
echo "   API Docs:    http://localhost:8000/docs"
echo "   Frontend:    http://localhost:1420"
echo ""
echo "🎤 Using the STT UI:"
echo ""
echo "1. Open browser to http://localhost:1420"
echo "2. Navigate to 'Models' page"
echo "3. Find an STT model (or scan for local models)"
echo "4. Click 'Open' on an STT model"
echo "5. Upload an audio file"
echo "6. Configure options (executor, model size, language)"
echo "7. Click 'Transcribe Audio'"
echo "8. View results and export!"
echo ""
echo "💡 Tips:"
echo "   - Use 'faster-whisper-stt' executor (recommended)"
echo "   - Use 'base' model for CPU, 'medium' for GPU"
echo "   - Enable 'VAD filtering' for better performance"
echo "   - Enable 'Word timestamps' for detailed results"
echo ""
echo "📚 Documentation:"
echo "   - STT_UI_INTEGRATION.md (complete guide)"
echo "   - STT_UI_VISUAL_GUIDE.md (UI layout)"
echo "   - STT_UI_COMPLETE_SUMMARY.md (summary)"
echo ""
echo "Press Ctrl+C to stop services"
echo ""

# Wait for interrupt
trap "echo ''; echo 'Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Services stopped.'; exit 0" INT

# Keep script running
wait
