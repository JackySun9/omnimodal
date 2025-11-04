from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.api.router import api_router
from app.core.config import settings
from app.core.db import init_db
from app.core.logging import setup_logging
from app.core.middleware import ErrorHandlingMiddleware, RequestLoggingMiddleware
from app.services.local_model_scanner import local_model_scanner
from app.executors.registry import register_builtin_executors

# Setup logging before anything else
setup_logging()

app = FastAPI(
    title="Unified Multimodal Platform API",
    version="0.1.0",
    description="Backend service for unified multimodal model management system",
)

# Add middleware (order matters - they execute in reverse order)
app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(RequestLoggingMiddleware)

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
    """Application startup handler."""
    try:
        logger.info("Starting up application...")
        
        # Register all built-in executors
        register_builtin_executors()
        logger.info("✅ Registered executors")
        
        # Initialize database
        await init_db()
        logger.info("✅ Database initialized")
        
        # Scan for existing local models
        try:
            counts = await local_model_scanner.scan_all()
            logger.info(f"✅ Scanned local models: {counts}")
        except Exception as e:
            logger.warning(f"⚠️  Error scanning local models: {e}", exc_info=True)
        
        logger.info("Application startup complete")
    except Exception as e:
        logger.exception(f"Failed to start application: {e}")
        raise


@app.on_event("shutdown")
async def on_shutdown() -> None:
    """Application shutdown handler."""
    try:
        logger.info("Shutting down application...")
        # TODO: gracefully stop executors and background workers
        logger.info("Application shutdown complete")
    except Exception as e:
        logger.exception(f"Error during shutdown: {e}")


app.include_router(api_router, prefix=settings.API_PREFIX)
