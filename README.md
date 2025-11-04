# Unified Multimodal Model Management Platform

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](https://fastapi.tiangolo.com)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131.svg)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Code style: ruff](https://img.shields.io/badge/code%20style-ruff-000000.svg)](https://github.com/astral-sh/ruff)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6.svg)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/yourusername/unified-multimodal-platform/graphs/commit-activity)
[![GitHub Issues](https://img.shields.io/github/issues/yourusername/unified-multimodal-platform.svg)](https://github.com/yourusername/unified-multimodal-platform/issues)
[![GitHub Stars](https://img.shields.io/github/stars/yourusername/unified-multimodal-platform.svg)](https://github.com/yourusername/unified-multimodal-platform/stargazers)

## 🎯 Overview

A comprehensive, hardware-aware desktop application for discovering, downloading, managing, and interacting with multimodal AI models. This platform solves the fragmentation in local AI tooling by providing a **unified interface** for text generation (LLMs), image generation, speech-to-text, text-to-speech, and video generation models.

> **📸 Screenshots and Demo Coming Soon!**  
> We're preparing visual demonstrations of the platform in action. Check back soon for screenshots and animated GIFs showing:
> - Dashboard with hardware detection
> - Model discovery and download interface
> - Text generation workspace
> - Image generation with real-time preview
> - Speech-to-text transcription demo

### Key Features

- 🔍 **Smart Model Discovery**: Search HuggingFace Hub with hardware compatibility scoring
- 📥 **Intelligent Downloads**: Automatic file filtering and organization by modality
- 🖥️ **Hardware-Aware Recommendations**: Real-time compatibility analysis (GPU/CPU/RAM)
- 🔌 **Modular Executor Architecture**: Pluggable backends (Ollama, whisper.cpp, Piper, etc.)
- 🎨 **Dynamic Workspaces**: Modality-specific UIs that adapt to your model type
- ⚙️ **Process Management**: Built-in lifecycle control for executor services
- 🚀 **Modern Stack**: FastAPI + Tauri for speed, security, and small footprint

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Tauri Desktop App                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  React Frontend                           │  │
│  │  • Dynamic Workspaces (Text/Image/Audio/Video)           │  │
│  │  • Hardware Profile Display                              │  │
│  │  • Model Discovery & Download UI                         │  │
│  │  • Zustand State Management                              │  │
│  └────────────────────┬─────────────────────────────────────┘  │
└────────────────────────┼────────────────────────────────────────┘
                         │ REST API (axios)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FastAPI Backend Server                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  API Endpoints: /hardware /models /executors             │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Services                                                 │  │
│  │  • HardwareService    • ModelDiscoveryService            │  │
│  │  • DownloadManager    • RecommendationEngine             │  │
│  │  • ProcessManager     • ExecutorService                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Executor Registry (Pluggable Architecture)              │  │
│  │  • OllamaExecutor        (text generation)               │  │
│  │  • OllamaDiffuser        (image generation)              │  │
│  │  • WhisperSTT            (speech-to-text, OpenAI)        │  │
│  │  • FasterWhisperSTT      (speech-to-text, optimized)     │  │
│  │  • WhisperCppSTT         (speech-to-text, C++)           │  │
│  │  • PiperTTS              (text-to-speech)                │  │
│  │  • StableVideoDiffusion  (video generation)              │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  SQLite Database (SQLModel ORM)                          │  │
│  │  • Local Model Catalog                                   │  │
│  │  • Download History                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              External Model Runtime Services                    │
│  • Ollama (localhost:11434)          → Text Generation          │
│  • OllamaDiffuser (localhost:11435)  → Image Generation         │
│  • whisper.cpp (localhost:8080)      → Speech-to-Text           │
│  • Piper (localhost:5000)            → Text-to-Speech           │
└─────────────────────────────────────────────────────────────────┘
```

## 📦 Structure

```
unified-multimodal-platform/
├── backend/                    # Python FastAPI backend
│   ├── app/
│   │   ├── api/               # REST API endpoints
│   │   │   └── v1/            # API version 1
│   │   ├── core/              # Configuration & database
│   │   ├── executors/         # Model runtime adapters
│   │   │   ├── text/          # Ollama integration
│   │   │   ├── image/         # OllamaDiffuser integration
│   │   │   ├── audio/         # Whisper.cpp, Piper
│   │   │   └── video/         # SVD integration
│   │   ├── models/            # SQLModel database schemas
│   │   ├── schemas/           # Pydantic request/response models
│   │   ├── services/          # Business logic
│   │   │   ├── hardware.py           # GPU/CPU detection
│   │   │   ├── recommendation.py     # Compatibility scoring
│   │   │   ├── model_discovery.py    # HF Hub search
│   │   │   ├── download_manager.py   # Model downloads
│   │   │   └── process_manager.py    # Executor lifecycle
│   │   └── utils/             # Utilities (GPU, CPU detection)
│   ├── pyproject.toml         # Python dependencies
│   └── data.db               # SQLite database
│
├── frontend/                  # Tauri + React frontend
│   ├── src/
│   │   ├── services/         # API client
│   │   ├── stores/           # Zustand state management
│   │   └── ui/
│   │       ├── pages/        # Main app pages
│   │       └── workspaces/   # Modality-specific UIs
│   │           ├── text/     # Chat interface
│   │           ├── image/    # Image generation UI
│   │           ├── stt/      # Audio upload & transcription
│   │           ├── tts/      # Text-to-speech controls
│   │           └── video/    # Video generation UI
│   ├── src-tauri/            # Tauri Rust backend
│   └── package.json
│
├── models/                    # Downloaded model storage
└── IMPLEMENTATION_SUMMARY.md  # Detailed technical docs
```

## 🚀 Getting Started

### Prerequisites

- **Python 3.11+** 
- **uv** (fast Python package manager): `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **Node.js 20+** and **pnpm**: `npm install -g pnpm`
- **Rust toolchain** (for Tauri): [rustup.rs](https://rustup.rs)
- **Ollama** (optional, for text generation): [ollama.com](https://ollama.com)

### Backend Setup

```bash
cd backend
uv sync --dev                  # Install dependencies
uv run uvicorn app.main:app --reload  # Start dev server
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Frontend Setup

**Option 1: Web Browser (Recommended for Development)**
```bash
cd frontend
pnpm install                   # Install dependencies
pnpm dev:web                   # Start Vite dev server
```

Open `http://localhost:1420` in your browser.

**Option 2: Tauri Desktop App**
```bash
cd frontend
pnpm install                   # Install dependencies
pnpm dev                       # Start Tauri desktop app
```

This launches the Tauri desktop application with hot-reload enabled.

### Configuration

Create a `.env` file in the `backend/` directory:

```bash
# Optional: HuggingFace token for private models
HUGGINGFACE_TOKEN=hf_...

# Database (defaults to SQLite)
DB_URL=sqlite+aiosqlite:///./data.db

# Redis (if using Celery for video generation tasks)
REDIS_URL=redis://localhost:6379/0
```

Create a `.env` file in the `frontend/` directory:

```bash
# Backend API URL (adjust if backend runs on different port)
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## 🎮 Usage

### 1. Model Discovery

1. Navigate to **Models** page
2. Enter search keywords (e.g., "llama 3 8b")
3. Click **Search** to query HuggingFace Hub
4. Models are automatically scored for hardware compatibility:
   - ✅ **Green**: Excellent fit for your hardware
   - ⚠️ **Yellow**: May work but could be slow
   - ❌ **Red**: Insufficient resources

### 2. Model Download

1. Select a compatible model from search results
2. Choose modality (text/image/audio/video)
3. Click **Add to Local Library**
4. Monitor download progress in real-time
5. Model appears in **Local Models** list when complete

### 3. Model Interaction

1. Select a model from your local library
2. Click **Open Workspace**
3. The UI adapts to the model type:
   - **Text**: Chat interface with temperature/token controls
   - **Image**: Prompt input, parameter sliders, image gallery
   - **STT**: Audio upload, transcription display
   - **TTS**: Text input, voice selection, audio player
   - **Video**: Prompt input, frame controls, video preview

## 🔧 Advanced Features

### Hardware Detection

The platform automatically detects:
- **GPU**: NVIDIA (via pynvml), AMD (via GPUtil), Apple Silicon
- **CPU**: Core count, instruction sets (AVX2, etc.)
- **RAM**: Total and available memory

Access hardware info via: `GET /api/v1/hardware`

### Process Management

The backend can start/stop executor services:

```python
from app.services.process_manager import process_manager

# Register a service
process_manager.register(ProcessConfig(
    name="ollama",
    command=["ollama", "serve"],
    port=11434,
    health_check_url="http://localhost:11434/api/tags",
    auto_restart=True
))

# Start the service
await process_manager.start("ollama")
```

### Custom Executors

Add support for new model types by implementing `BaseExecutor`:

```python
from app.executors.base import BaseExecutor

class MyCustomExecutor(BaseExecutor):
    name = "my-executor"
    modality = "custom"
    
    async def load_model(self, model: LocalModel) -> None:
        # Load model into your runtime
        pass
    
    async def execute(self, request: ExecutionRequest) -> ExecutionResponse:
        # Run inference
        pass
```

Register in `app/executors/registry.py`:

```python
registry.register(MyCustomExecutor.name, MyCustomExecutor)
```

## 📊 API Reference

### Hardware
- `GET /api/v1/hardware` - Get system hardware profile

### Models
- `GET /api/v1/models/local` - List installed models
- `POST /api/v1/models/download` - Queue model download
- `DELETE /api/v1/models/{id}` - Delete model
- `GET /api/v1/models/downloads` - List download tasks
- `POST /api/v1/models/discover` - Search HuggingFace with compatibility scoring

### Executors
- `GET /api/v1/executors/{name}/status` - Check executor health
- `POST /api/v1/executors/{name}/execute` - Run inference
- `GET /api/v1/executors/{name}/tasks/{id}` - Get task status

See full API docs at `http://localhost:8000/docs` (when backend is running).

## 🧪 Development

### Backend Development

```bash
cd backend
uv run pytest                  # Run tests
uv run ruff check app/         # Lint code
uv run ruff format app/        # Format code
```

### Frontend Development

```bash
cd frontend
pnpm lint                      # Lint TypeScript
pnpm build                     # Build production app
```

## 📚 Documentation

- **[Implementation Summary](./IMPLEMENTATION_SUMMARY.md)**: Detailed technical documentation
- **[Backend README](./backend/README.md)**: Backend-specific setup and architecture
- **API Docs**: Interactive Swagger UI at `/docs` endpoint

## 🛠️ Technology Stack

### Backend
- **FastAPI**: Modern async web framework
- **SQLModel**: Type-safe ORM with async support
- **HuggingFace Hub**: Model discovery and downloads
- **pynvml/GPUtil**: GPU detection
- **psutil**: System resource monitoring
- **httpx**: Async HTTP client for executor APIs

### Frontend
- **Tauri 2.0**: Lightweight desktop framework
- **React 18**: UI library with hooks
- **TypeScript**: Type-safe JavaScript
- **Zustand**: Minimal state management
- **Axios**: HTTP client

### Executors
- **Ollama**: Local LLM runtime
- **OllamaDiffuser**: Local Stable Diffusion runtime
- **OpenAI Whisper**: High-quality speech recognition
- **Faster-Whisper**: Optimized Whisper (4x faster, lower memory)
- **whisper.cpp**: Fast whisper inference (C++ implementation)
- **Piper**: Neural TTS

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

**Areas of interest:**
- Additional executor integrations (Coqui TTS, AnimateDiff, etc.)
- UI/UX improvements
- Testing coverage
- Documentation
- Performance optimizations
- Bug fixes and issue reports

**Quick Start for Contributors:**

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

**TL;DR:** You can use, modify, and distribute this software freely, even for commercial purposes. Apache 2.0 provides an express grant of patent rights from contributors to users and includes protections against patent litigation.

## 🙏 Acknowledgments

- [Ollama](https://ollama.com) for excellent local LLM runtime
- [OllamaDiffuser](https://ollamadiffuser.com) for excellent local Image LLM runtime
- [HuggingFace](https://huggingface.co) for model hosting and APIs
- [Tauri](https://tauri.app) for modern desktop framework
- [FastAPI](https://fastapi.tiangolo.com) for developer-friendly API framework

---

**Built with ❤️ for the local AI community**
