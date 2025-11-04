from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.db import init_db
from app.services.local_model_scanner import local_model_scanner
from app.executors.registry import register_builtin_executors

app = FastAPI(
    title="Unified Multimodal Platform API",
    version="0.1.0",
    description="Backend service for unified multimodal model management system",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "tauri://localhost",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup() -> None:
    # Register all built-in executors
    register_builtin_executors()
    print("✅ Registered executors")
    
    await init_db()
    # Scan for existing local models
    try:
        counts = await local_model_scanner.scan_all()
        print(f"✅ Scanned local models: {counts}")
    except Exception as e:
        print(f"⚠️  Error scanning local models: {e}")
    # TODO: initialize connections, preload models, scheduler


@app.on_event("shutdown")
async def on_shutdown() -> None:
    # TODO: gracefully stop executors and background workers
    pass


app.include_router(api_router, prefix=settings.API_PREFIX)
