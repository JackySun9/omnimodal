from __future__ import annotations

from typing import Dict, Optional
from uuid import UUID, uuid4
import httpx

from loguru import logger

import app.executors  # noqa: F401
from app.executors.base import BaseExecutor
from app.executors.registry import registry
from app.schemas.executors import ExecutionRequest, ExecutionResponse, ExecutorStatusResponse
from app.core.exceptions import ExecutorError, NotFoundError, ExternalServiceError
from app.utils.retry import retry_async, RetryConfig


class ExecutorService:
    _global_instances: Dict[str, BaseExecutor] = {}  # Shared across all ExecutorService instances
    
    def __init__(self) -> None:
        self._registry = registry
        self._tasks: dict[UUID, ExecutionResponse] = {}

    def _get_executor(self, executor_name: str) -> Optional[BaseExecutor]:
        """Get or create an executor instance."""
        # Use global shared instances to persist loaded models across API requests
        if executor_name in self._global_instances:
            return self._global_instances[executor_name]
        executor_cls = self._registry.get(executor_name)
        if executor_cls is None:
            logger.warning(f"Executor not found in registry: {executor_name}")
            return None
        try:
            instance = executor_cls()
            self._global_instances[executor_name] = instance
            logger.info(f"Created new executor instance: {executor_name}")
            return instance
        except Exception as e:
            logger.exception(f"Failed to create executor instance for {executor_name}: {e}")
            raise ExecutorError(
                f"Failed to initialize executor '{executor_name}': {str(e)}",
                details={"executor_name": executor_name}
            )

    async def get_status(self, executor_name: str) -> Optional[ExecutorStatusResponse]:
        """Get executor status."""
        executor = self._get_executor(executor_name)
        if executor is None:
            return None
        try:
            status = await executor.get_status()
            return ExecutorStatusResponse(executor=status)
        except Exception as e:
            logger.exception(f"Error getting status for executor {executor_name}: {e}")
            raise ExecutorError(
                f"Failed to get executor status: {str(e)}",
                details={"executor_name": executor_name}
            )

    async def execute(self, executor_name: str, payload: ExecutionRequest) -> ExecutionResponse:
        """Execute a task on an executor."""
        executor = self._get_executor(executor_name)
        if executor is None:
            raise NotFoundError(
                f"Executor '{executor_name}' not found",
                details={"executor_name": executor_name}
            )
        
        # Execute immediately and return result
        try:
            logger.debug(f"Executing task on {executor_name}")
            response = await executor.execute(payload)
            # Store in tasks for potential later retrieval
            if response.task_id:
                self._tasks[response.task_id] = response
            return response
        except Exception as e:
            logger.exception(f"Execution failed on {executor_name}: {e}")
            # Return error response
            task_id = uuid4()
            error_response = ExecutionResponse(
                task_id=task_id,
                result={"error": str(e)},
                status="error",
                metadata={"executor": executor_name, "parameters": payload.parameters},
            )
            self._tasks[task_id] = error_response
            return error_response

    async def get_task_status(self, executor_name: str, task_id: UUID) -> Optional[ExecutionResponse]:
        _ = self._get_executor(executor_name)
        return self._tasks.get(task_id)
    
    async def execute_stream(self, executor_name: str, payload: ExecutionRequest):
        """Execute with streaming support (for text generation)."""
        executor = self._get_executor(executor_name)
        if executor is None:
            raise ValueError(f"Executor '{executor_name}' is not registered")
        
        # Check if executor supports streaming
        if not hasattr(executor, 'generate_text_stream'):
            raise ValueError(f"Executor '{executor_name}' does not support streaming")
        
        # Stream the response
        async for chunk in executor.generate_text_stream(payload.parameters):
            yield chunk
    
    async def start_executor(self, executor_name: str):
        """Start the executor service (mainly for ollama-diffuser)."""
        if executor_name == "ollama-diffuser":
            import subprocess
            import asyncio
            import shutil
            import os
            
            # Check if already running
            executor = self._get_executor(executor_name)
            if executor:
                status = await executor.get_status()
                if status.is_running:
                    return {"status": "already_running"}
            
            # Find ollamadiffuser command
            ollama_cmd = shutil.which("ollamadiffuser")
            
            # If not found in PATH, try common pyenv locations
            if not ollama_cmd:
                home = os.path.expanduser("~")
                possible_paths = [
                    f"{home}/.pyenv/shims/ollamadiffuser",
                    f"{home}/.pyenv/versions/3.10.0/bin/ollamadiffuser",
                    "/usr/local/bin/ollamadiffuser",
                ]
                for path in possible_paths:
                    if os.path.exists(path):
                        ollama_cmd = path
                        break
            
            if not ollama_cmd:
                raise RuntimeError(
                    "ollamadiffuser command not found. Please install it with: pip install ollamadiffuser"
                )
            
            # Start ollamadiffuser serve in background on port 11435
            try:
                process = subprocess.Popen(
                    [ollama_cmd, "serve", "--port", "11435"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    start_new_session=True,
                )
                
                # Wait a bit for the service to start
                await asyncio.sleep(3)
                
                # Check if it started successfully
                if executor:
                    status = await executor.get_status()
                    if status.is_running:
                        return {"status": "started", "pid": process.pid, "command": ollama_cmd}
                
                return {
                    "status": "started", 
                    "pid": process.pid, 
                    "command": ollama_cmd,
                    "note": "Service may still be initializing"
                }
            except Exception as e:
                raise RuntimeError(f"Failed to start ollama-diffuser: {str(e)}")
        else:
            raise ValueError(f"Start operation not supported for executor '{executor_name}'")
    
    async def load_model(self, executor_name: str, model_name: str):
        """Load a model into the executor with retry logic."""
        executor = self._get_executor(executor_name)
        if executor is None:
            raise NotFoundError(
                f"Executor '{executor_name}' not found",
                details={"executor_name": executor_name}
            )
        
        if executor_name == "ollama-diffuser":
            # Use retry logic for external service calls
            async def _load_model_with_http():
                async with httpx.AsyncClient(timeout=120.0) as client:
                    logger.info(f"Loading model '{model_name}' into ollama-diffuser...")
                    response = await client.post(
                        "http://localhost:11435/api/models/load",
                        json={"model_name": model_name},
                    )
                    response.raise_for_status()
                    data = response.json()
                    logger.info(f"Model loaded successfully: {data}")
                    return {
                        "status": "loaded",
                        "model": model_name,
                        "info": data,
                    }
            
            try:
                # Retry on connection errors and timeouts
                return await retry_async(
                    _load_model_with_http,
                    config=RetryConfig(max_attempts=3, initial_delay=2.0),
                    retryable_exceptions=(httpx.ConnectError, httpx.TimeoutException),
                )
            except httpx.HTTPStatusError as e:
                error_detail = e.response.text if hasattr(e, 'response') else str(e)
                logger.error(f"HTTP error loading model: {e.response.status_code} - {error_detail}")
                
                # Provide helpful error message for common issues
                if e.response.status_code == 400:
                    raise ExternalServiceError(
                        f"Model '{model_name}' failed to load. "
                        f"Possible causes:\n"
                        f"1. Model is corrupted or not fully downloaded (check 'ollamadiffuser list')\n"
                        f"2. Model name mismatch\n"
                        f"3. Insufficient VRAM\n"
                        f"Try: ollamadiffuser pull {model_name}",
                        service_name="ollama-diffuser",
                        details={"model_name": model_name, "status_code": e.response.status_code}
                    )
                raise ExternalServiceError(
                    f"Failed to load model (HTTP {e.response.status_code}): {error_detail}",
                    service_name="ollama-diffuser",
                    details={"model_name": model_name, "status_code": e.response.status_code}
                )
            except httpx.ConnectError as e:
                logger.error(f"Connection error: {str(e)}")
                raise ExternalServiceError(
                    "Cannot connect to OllamaDiffuser at localhost:11435. Is the service running?",
                    service_name="ollama-diffuser",
                    details={"model_name": model_name}
                )
            except httpx.TimeoutException as e:
                logger.error(f"Timeout loading model: {str(e)}")
                raise ExternalServiceError(
                    "Model loading timed out after retries. Large models may take several minutes to load.",
                    service_name="ollama-diffuser",
                    details={"model_name": model_name}
                )
            except Exception as e:
                logger.exception(f"Unexpected error loading model: {str(e)}")
                raise ExecutorError(
                    f"Failed to load model: {str(e)}",
                    details={"executor_name": executor_name, "model_name": model_name}
                )
        else:
            # For other executors, use the load_model method if available
            if hasattr(executor, 'load_model'):
                # STT executors use model size identifiers (tiny, base, small, etc.) 
                # that don't need to be registered in the database
                if executor_name in ["whisper-stt", "faster-whisper-stt", "whispercpp-stt"]:
                    from app.schemas.models import LocalModel
                    # Create a LocalModel object on the fly with the model size as the name
                    model = LocalModel(
                        id=uuid4(),
                        name=model_name,
                        modality="audio",
                        path="",  # STT executors will download from HuggingFace if needed
                        model_metadata={"model_size": model_name}
                    )
                    await executor.load_model(model)
                    return {"status": "loaded", "model": model_name}
                else:
                    # For other executors, look up the model in the database
                    from app.services.models_service import ModelsService
                    models_service = ModelsService()
                    model = await models_service.get_model_by_name(model_name)
                    if model:
                        await executor.load_model(model)
                        return {"status": "loaded", "model": model_name}
                    else:
                        raise ValueError(f"Model '{model_name}' not found")
            raise ValueError(f"Model loading not supported for executor '{executor_name}'")
    
    async def get_model_info(self, executor_name: str, model_name: str):
        """Get model information and recommended parameters."""
        if executor_name == "ollama-diffuser":
            # Get model info from ollama-diffuser API
            import httpx
            async with httpx.AsyncClient(timeout=30.0) as client:
                try:
                    response = await client.get(
                        f"http://localhost:11435/api/models/info?model={model_name}",
                    )
                    response.raise_for_status()
                    data = response.json()
                    
                    # Return model info with default parameters
                    return {
                        "model_name": model_name,
                        "info": data,
                        "default_parameters": {
                            "width": data.get("default_width", 1024),
                            "height": data.get("default_height", 1024),
                            "steps": data.get("default_steps", 28),
                            "cfg_scale": data.get("default_cfg_scale", 3.5),
                            "scheduler": data.get("default_scheduler", "default"),
                        }
                    }
                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 404:
                        # Model info endpoint might not exist, return defaults
                        return {
                            "model_name": model_name,
                            "default_parameters": self._get_default_diffusion_params(model_name),
                        }
                    raise
                except Exception as e:
                    # Fallback to defaults if API not available
                    return {
                        "model_name": model_name,
                        "default_parameters": self._get_default_diffusion_params(model_name),
                    }
        else:
            raise ValueError(f"Model info not supported for executor '{executor_name}'")
    
    def _get_default_diffusion_params(self, model_name: str) -> dict:
        """Get default parameters based on model name."""
        model_lower = model_name.lower()
        
        # SD3.5 Large defaults
        if "sd3.5-large" in model_lower or "sd35-large" in model_lower:
            return {
                "width": 1024,
                "height": 1024,
                "steps": 28,
                "cfg_scale": 4.5,
            }
        # SD3.5 Medium defaults
        elif "sd3.5-medium" in model_lower or "sd35-medium" in model_lower:
            return {
                "width": 1024,
                "height": 1024,
                "steps": 28,
                "cfg_scale": 5.0,
            }
        # Schnell (fast) models
        elif "schnell" in model_lower:
            return {
                "width": 1024,
                "height": 1024,
                "steps": 4,
                "cfg_scale": 0.0,  # Schnell doesn't use CFG
            }
        # Turbo models
        elif "turbo" in model_lower:
            return {
                "width": 512,
                "height": 512,
                "steps": 8,
                "cfg_scale": 2.0,
            }
        # SDXL defaults
        elif "xl" in model_lower:
            return {
                "width": 1024,
                "height": 1024,
                "steps": 30,
                "cfg_scale": 7.0,
            }
        # SD 1.5/2.1 defaults
        else:
            return {
                "width": 512,
                "height": 512,
                "steps": 25,
                "cfg_scale": 7.5,
            }
