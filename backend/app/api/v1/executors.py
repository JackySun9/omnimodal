from uuid import UUID

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from loguru import logger

from app.schemas.executors import (
    ExecutionRequest,
    ExecutionResponse,
    ExecutorStatusResponse,
)
from app.services.executor_service import ExecutorService
from app.core.exceptions import NotFoundError, ExecutorError

router = APIRouter()


@router.get("/{executor_name}/status", response_model=ExecutorStatusResponse)
async def get_executor_status(executor_name: str) -> ExecutorStatusResponse:
    """Get the status of an executor."""
    try:
        logger.info(f"Getting status for executor: {executor_name}")
        service = ExecutorService()
        status = await service.get_status(executor_name)
        if status is None:
            logger.warning(f"Executor not found: {executor_name}")
            raise NotFoundError(
                f"Executor '{executor_name}' not found",
                details={"executor_name": executor_name}
            )
        logger.debug(f"Executor {executor_name} status: {status}")
        return status
    except NotFoundError:
        raise
    except Exception as e:
        logger.exception(f"Error getting executor status for {executor_name}: {e}")
        raise ExecutorError(
            f"Failed to get executor status: {str(e)}",
            details={"executor_name": executor_name}
        )


@router.post("/{executor_name}/execute", response_model=ExecutionResponse)
async def execute_job(executor_name: str, payload: ExecutionRequest) -> ExecutionResponse:
    """Execute a job on the specified executor."""
    try:
        logger.info(f"Executing job on {executor_name} with parameters: {payload.parameters}")
        service = ExecutorService()
        result = await service.execute(executor_name, payload)
        logger.info(f"Job executed successfully on {executor_name}, task_id: {result.task_id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error executing job on {executor_name}: {e}")
        raise NotFoundError(str(e), details={"executor_name": executor_name})
    except Exception as e:
        logger.exception(f"Error executing job on {executor_name}: {e}")
        raise ExecutorError(
            f"Failed to execute job: {str(e)}",
            details={"executor_name": executor_name, "parameters": payload.parameters}
        )


@router.get("/{executor_name}/tasks/{task_id}", response_model=ExecutionResponse)
async def get_task_status(executor_name: str, task_id: UUID) -> ExecutionResponse:
    """Get the status of a specific task."""
    try:
        logger.info(f"Getting task status for {task_id} on {executor_name}")
        service = ExecutorService()
        response = await service.get_task_status(executor_name, task_id)
        if response is None:
            logger.warning(f"Task not found: {task_id} on {executor_name}")
            raise NotFoundError(
                f"Task '{task_id}' not found",
                details={"executor_name": executor_name, "task_id": str(task_id)}
            )
        return response
    except NotFoundError:
        raise
    except Exception as e:
        logger.exception(f"Error getting task status for {task_id} on {executor_name}: {e}")
        raise ExecutorError(
            f"Failed to get task status: {str(e)}",
            details={"executor_name": executor_name, "task_id": str(task_id)}
        )


@router.post("/{executor_name}/stream")
async def stream_execute(executor_name: str, payload: ExecutionRequest):
    """Execute with streaming response (Server-Sent Events)."""
    logger.info(f"Starting streaming execution on {executor_name}")
    service = ExecutorService()
    
    async def event_generator():
        """Generate SSE events."""
        try:
            async for chunk in service.execute_stream(executor_name, payload):
                import json
                # SSE format: data: {json}\n\n
                yield f"data: {json.dumps(chunk)}\n\n"
            logger.info(f"Streaming execution completed for {executor_name}")
        except ValueError as e:
            logger.error(f"Validation error in streaming execution: {e}")
            import json
            yield f"data: {json.dumps({'error': str(e), 'error_type': 'ValidationError'})}\n\n"
        except Exception as e:
            logger.exception(f"Error in streaming execution on {executor_name}: {e}")
            import json
            yield f"data: {json.dumps({'error': 'An error occurred during streaming', 'error_type': 'ExecutorError'})}\n\n"
    
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
    try:
        logger.info(f"Starting executor: {executor_name}")
        service = ExecutorService()
        result = await service.start_executor(executor_name)
        logger.info(f"Executor {executor_name} started successfully")
        return {"status": "started", "executor": executor_name, **result}
    except ValueError as e:
        logger.error(f"Invalid executor or operation: {e}")
        raise NotFoundError(str(e), details={"executor_name": executor_name})
    except RuntimeError as e:
        logger.error(f"Failed to start executor {executor_name}: {e}")
        raise ExecutorError(str(e), details={"executor_name": executor_name})
    except Exception as e:
        logger.exception(f"Unexpected error starting executor {executor_name}: {e}")
        raise ExecutorError(
            f"Failed to start executor: {str(e)}",
            details={"executor_name": executor_name}
        )


@router.post("/{executor_name}/load-model")
async def load_model(executor_name: str, payload: dict):
    """Load a specific model into the executor."""
    try:
        model_name = payload.get("model_name")
        if not model_name:
            logger.warning("load-model called without model_name")
            raise HTTPException(status_code=400, detail="model_name is required")
        
        logger.info(f"Loading model '{model_name}' into executor {executor_name}")
        service = ExecutorService()
        result = await service.load_model(executor_name, model_name)
        logger.info(f"Model '{model_name}' loaded successfully into {executor_name}")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error loading model: {e}")
        raise NotFoundError(str(e), details={"executor_name": executor_name, "model_name": model_name})
    except RuntimeError as e:
        logger.error(f"Runtime error loading model '{model_name}' into {executor_name}: {e}")
        raise ExecutorError(str(e), details={"executor_name": executor_name, "model_name": model_name})
    except Exception as e:
        logger.exception(f"Unexpected error loading model '{model_name}' into {executor_name}: {e}")
        raise ExecutorError(
            f"Failed to load model: {str(e)}",
            details={"executor_name": executor_name, "model_name": model_name}
        )


@router.get("/{executor_name}/model-info")
async def get_model_info(executor_name: str, model_name: str):
    """Get model information and default parameters."""
    try:
        logger.info(f"Getting model info for '{model_name}' from executor {executor_name}")
        service = ExecutorService()
        info = await service.get_model_info(executor_name, model_name)
        return info
    except ValueError as e:
        logger.error(f"Validation error getting model info: {e}")
        raise NotFoundError(str(e), details={"executor_name": executor_name, "model_name": model_name})
    except Exception as e:
        logger.exception(f"Error getting model info for '{model_name}' from {executor_name}: {e}")
        raise ExecutorError(
            f"Failed to get model info: {str(e)}",
            details={"executor_name": executor_name, "model_name": model_name}
        )
