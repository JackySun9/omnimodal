# Unified Multimodal Backend

Core FastAPI service powering the unified multimodal model management platform.

## Requirements
- Python 3.11+
- [uv](https://docs.astral.sh/uv/)

## Setup
```bash
uv sync --dev
```

## Running the API
```bash
uv run uvicorn app.main:app --reload
```

The first startup automatically initializes the SQLite database specified by `DB_URL` (defaults to `sqlite+aiosqlite:///./data.db`). Tables are defined with SQLModel under `app/models/`.

### Model download workflow
- `POST /api/v1/models/download` queues a simulated download task (10-step progress) and returns a task identifier.
- `GET /api/v1/models/downloads` lists all download tasks with status/progress.
- Upon completion, the model is persisted to `local_models` for immediate availability through `GET /api/v1/models/local`.

## Key Modules
- `app/core/db.py`: Async SQLModel engine/session helpers and schema initialization.
- `app/models/local_model.py`: Persistent model catalog table.
- `app/services/model_manager.py`: CRUD operations backed by the database.
- `app/services/download_manager.py`: Async in-memory download queue driving model registration.
- `app/executors/`: Abstract executor base class, builtin registry, and placeholder modality executors.
