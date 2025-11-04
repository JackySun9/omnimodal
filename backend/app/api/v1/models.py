from uuid import UUID

from fastapi import APIRouter

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

router = APIRouter()


@router.get("/local", response_model=LocalModelListResponse)
async def list_local_models() -> LocalModelListResponse:
    service = ModelManagerService()
    models = await service.list_local_models()
    return LocalModelListResponse(models=models)


@router.post("/download", response_model=DownloadTask)
async def download_model(payload: LocalModelCreateRequest) -> DownloadTask:
    return await download_manager.start_download(payload)


@router.delete("/{model_id}")
async def delete_model(model_id: UUID) -> None:
    service = ModelManagerService()
    await service.delete_model(model_id)


@router.get("/downloads", response_model=DownloadTaskListResponse)
async def list_downloads() -> DownloadTaskListResponse:
    items = await download_manager.list_downloads()
    return DownloadTaskListResponse(items=items)


@router.post("/discover", response_model=ModelSearchResponse)
async def discover_models(filters: ModelSearchFilters) -> ModelSearchResponse:
    service = ModelDiscoveryService()
    items = await service.search(filters)
    return ModelSearchResponse(items=items)


@router.post("/scan")
async def scan_local_models() -> dict:
    """Scan local directories for existing models (Ollama, HuggingFace, OllamaDiffuser)."""
    counts = await local_model_scanner.scan_all()
    return {
        "success": True,
        "message": f"Scanned {sum(counts.values())} models",
        "counts": counts,
    }
