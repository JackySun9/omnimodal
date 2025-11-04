from uuid import UUID

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.executors import (
    ExecutionRequest,
    ExecutionResponse,
    ExecutorStatusResponse,
)
from app.services.executor_service import ExecutorService

router = APIRouter()


@router.get("/{executor_name}/status", response_model=ExecutorStatusResponse)
async def get_executor_status(executor_name: str) -> ExecutorStatusResponse:
    service = ExecutorService()
    status = await service.get_status(executor_name)
    if status is None:
        raise HTTPException(status_code=404, detail="Executor not found")
    return status


@router.post("/{executor_name}/execute", response_model=ExecutionResponse)
async def execute_job(executor_name: str, payload: ExecutionRequest) -> ExecutionResponse:
    service = ExecutorService()
    return await service.execute(executor_name, payload)


@router.get("/{executor_name}/tasks/{task_id}", response_model=ExecutionResponse)
async def get_task_status(executor_name: str, task_id: UUID) -> ExecutionResponse:
    service = ExecutorService()
    response = await service.get_task_status(executor_name, task_id)
    if response is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return response


@router.post("/{executor_name}/stream")
async def stream_execute(executor_name: str, payload: ExecutionRequest):
    """Execute with streaming response (Server-Sent Events)."""
    service = ExecutorService()
    
    async def event_generator():
        """Generate SSE events."""
        try:
            async for chunk in service.execute_stream(executor_name, payload):
                import json
                # SSE format: data: {json}\n\n
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{executor_name}/start")
async def start_executor(executor_name: str):
    """Start the executor service (for ollama-diffuser)."""
    service = ExecutorService()
    try:
        await service.start_executor(executor_name)
        return {"status": "started", "executor": executor_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{executor_name}/load-model")
async def load_model(executor_name: str, payload: dict):
    """Load a specific model into the executor."""
    service = ExecutorService()
    model_name = payload.get("model_name")
    if not model_name:
        raise HTTPException(status_code=400, detail="model_name is required")
    
    try:
        result = await service.load_model(executor_name, model_name)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{executor_name}/model-info")
async def get_model_info(executor_name: str, model_name: str):
    """Get model information and default parameters."""
    service = ExecutorService()
    try:
        info = await service.get_model_info(executor_name, model_name)
        return info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
