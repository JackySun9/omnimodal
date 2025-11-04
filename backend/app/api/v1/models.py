from uuid import UUID

from fastapi import APIRouter
from loguru import logger

from app.schemas.models import (
    DownloadTask,
    DownloadTaskListResponse,
    LocalModel,
    LocalModelCreateRequest,
    LocalModelListResponse,
    ModelSearchFilters,
    ModelSearchResponse,
)
from app.services.download_manager import download_manager
from app.services.model_discovery import ModelDiscoveryService
from app.services.model_manager import ModelManagerService
from app.services.local_model_scanner import local_model_scanner
from app.core.exceptions import NotFoundError, ModelError

router = APIRouter()


@router.get("/local", response_model=LocalModelListResponse)
async def list_local_models() -> LocalModelListResponse:
    """List all local models."""
    try:
        logger.info("Listing local models")
        service = ModelManagerService()
        models = await service.list_local_models()
        logger.debug(f"Found {len(models)} local models")
        return LocalModelListResponse(models=models)
    except Exception as e:
        logger.exception(f"Error listing local models: {e}")
        raise ModelError(f"Failed to list local models: {str(e)}")


@router.post("/download", response_model=DownloadTask)
async def download_model(payload: LocalModelCreateRequest) -> DownloadTask:
    """Schedule a model download."""
    try:
        logger.info(f"Starting download for model: {payload.source_id}")
        task = await download_manager.start_download(payload)
        logger.info(f"Download task created: {task.task_id}")
        return task
    except Exception as e:
        logger.exception(f"Error starting download for {payload.source_id}: {e}")
        raise ModelError(f"Failed to start download: {str(e)}", details={"source_id": payload.source_id})


@router.delete("/{model_id}")
async def delete_model(model_id: UUID) -> None:
    """Delete a local model."""
    try:
        logger.info(f"Deleting model: {model_id}")
        service = ModelManagerService()
        await service.delete_model(model_id)
        logger.info(f"Model deleted successfully: {model_id}")
    except ValueError as e:
        logger.warning(f"Model not found for deletion: {model_id}")
        raise NotFoundError(f"Model not found: {str(e)}", details={"model_id": str(model_id)})
    except Exception as e:
        logger.exception(f"Error deleting model {model_id}: {e}")
        raise ModelError(f"Failed to delete model: {str(e)}", details={"model_id": str(model_id)})


@router.get("/downloads", response_model=DownloadTaskListResponse)
async def list_downloads() -> DownloadTaskListResponse:
    """List all download tasks."""
    try:
        logger.debug("Listing download tasks")
        items = await download_manager.list_downloads()
        return DownloadTaskListResponse(items=items)
    except Exception as e:
        logger.exception(f"Error listing downloads: {e}")
        raise ModelError(f"Failed to list downloads: {str(e)}")


@router.post("/discover", response_model=ModelSearchResponse)
async def discover_models(filters: ModelSearchFilters) -> ModelSearchResponse:
    """Discover models from HuggingFace."""
    try:
        logger.info(f"Discovering models with filters: {filters}")
        service = ModelDiscoveryService()
        items = await service.search(filters)
        logger.info(f"Found {len(items)} models")
        return ModelSearchResponse(items=items)
    except Exception as e:
        logger.exception(f"Error discovering models: {e}")
        raise ModelError(f"Failed to discover models: {str(e)}")


@router.post("/scan")
async def scan_local_models() -> dict:
    """Scan local directories for existing models (Ollama, HuggingFace, OllamaDiffuser)."""
    try:
        logger.info("Starting local model scan")
        counts = await local_model_scanner.scan_all()
        total = sum(counts.values())
        logger.info(f"Scan complete: {counts}")
        return {
            "success": True,
            "message": f"Scanned {total} models",
            "counts": counts,
        }
    except Exception as e:
        logger.exception(f"Error scanning local models: {e}")
        raise ModelError(f"Failed to scan local models: {str(e)}")
