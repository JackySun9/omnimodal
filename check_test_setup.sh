#!/bin/bash

# Check if test environment is properly set up

echo "🔍 Checking Test Environment Setup"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check backend
echo "📦 Backend Setup"
echo "----------------"
if [ -d "backend/.venv" ]; then
    echo -e "${GREEN}✅ Virtual environment exists${NC}"
else
    echo -e "${RED}❌ Virtual environment not found${NC}"
    echo "   Run: cd backend && uv sync --dev"
fi

if [ -f "backend/.venv/bin/pytest" ] || [ -f "backend/.venv/Scripts/pytest.exe" ]; then
    echo -e "${GREEN}✅ pytest installed${NC}"
else
    echo -e "${RED}❌ pytest not installed${NC}"
    echo "   Run: cd backend && uv sync --dev"
fi

echo ""

# Check frontend
echo "⚛️  Frontend Setup"
echo "------------------"
if [ -d "frontend/node_modules" ]; then
    echo -e "${GREEN}✅ node_modules exists${NC}"
else
    echo -e "${RED}❌ node_modules not found${NC}"
    echo "   Run: cd frontend && pnpm install"
fi

if [ -f "frontend/node_modules/.bin/vitest" ]; then
    echo -e "${GREEN}✅ vitest installed${NC}"
else
    echo -e "${RED}❌ vitest not installed${NC}"
    echo "   Run: cd frontend && pnpm install"
fi

if [ -f "frontend/node_modules/.bin/playwright" ]; then
    echo -e "${GREEN}✅ playwright installed${NC}"
else
    echo -e "${RED}❌ playwright not installed${NC}"
    echo "   Run: cd frontend && pnpm install"
fi

echo ""
echo "📋 Next Steps"
echo "-------------"
echo ""

# Check what needs to be done
NEEDS_BACKEND=false
NEEDS_FRONTEND=false

if [ ! -d "backend/.venv" ] || [ ! -f "backend/.venv/bin/pytest" ]; then
    NEEDS_BACKEND=true
fi

if [ ! -d "frontend/node_modules" ] || [ ! -f "frontend/node_modules/.bin/vitest" ]; then
    NEEDS_FRONTEND=true
fi

if [ "$NEEDS_BACKEND" = true ] && [ "$NEEDS_FRONTEND" = true ]; then
    echo "Run these commands to set up everything:"
    echo ""
    echo "  cd backend && uv sync --dev && cd .."
    echo "  cd frontend && pnpm install && cd .."
    echo "  ./run_all_tests.sh"
elif [ "$NEEDS_BACKEND" = true ]; then
    echo "Backend needs setup:"
    echo ""
    echo "  cd backend && uv sync --dev && cd .."
    echo "  ./run_all_tests.sh"
elif [ "$NEEDS_FRONTEND" = true ]; then
    echo "Frontend needs setup:"
    echo ""
    echo "  cd frontend && pnpm install && cd .."
    echo "  ./run_all_tests.sh"
else
    echo -e "${GREEN}✅ Everything is set up! You can run:${NC}"
    echo ""
    echo "  ./run_all_tests.sh"
fi

echo ""
