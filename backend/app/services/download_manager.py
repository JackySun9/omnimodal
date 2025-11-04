from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict
from uuid import UUID, uuid4

import anyio
from huggingface_hub import hf_hub_download, list_repo_files

from app.core.config import settings
from app.schemas.models import DownloadStatus, DownloadTask, LocalModelCreateRequest
from app.services.model_manager import ModelManagerService


@dataclass
class _DownloadTaskState:
    task_id: UUID
    payload: LocalModelCreateRequest
    status: DownloadStatus = DownloadStatus.queued
    progress: float = 0.0
    error: str | None = None
    model_id: UUID | None = None

    def to_response(self) -> DownloadTask:
        return DownloadTask(
            task_id=self.task_id,
            source_id=self.payload.source_id,
            modality=self.payload.modality,
            executor=self.payload.executor,
            status=self.status,
            progress=self.progress,
            error=self.error,
            model_id=self.model_id,
        )


class DownloadManager:
    def __init__(self) -> None:
        self._tasks: Dict[UUID, _DownloadTaskState] = {}
        self._lock = asyncio.Lock()
        # Base directory for storing downloaded models
        self._models_dir = Path("./models")
        self._models_dir.mkdir(exist_ok=True)

    async def start_download(self, payload: LocalModelCreateRequest) -> DownloadTask:
        task_id = uuid4()
        state = _DownloadTaskState(task_id=task_id, payload=payload)
        async with self._lock:
            self._tasks[task_id] = state
        asyncio.create_task(self._download_from_huggingface(state))
        return state.to_response()

    async def list_downloads(self) -> list[DownloadTask]:
        async with self._lock:
            return [state.to_response() for state in self._tasks.values()]

    async def get_download(self, task_id: UUID) -> DownloadTask | None:
        async with self._lock:
            state = self._tasks.get(task_id)
            return state.to_response() if state else None

    async def _download_from_huggingface(self, state: _DownloadTaskState) -> None:
        """Download a model from HuggingFace Hub."""
        state.status = DownloadStatus.downloading
        repo_id = state.payload.source_id
        
        try:
            # Create model-specific directory
            model_dir = self._models_dir / repo_id.replace("/", "--")
            model_dir.mkdir(parents=True, exist_ok=True)
            
            # Get list of files in the repository
            def _list_files() -> list[str]:
                return list_repo_files(
                    repo_id=repo_id,
                    token=settings.HUGGINGFACE_TOKEN,
                )
            
            files = await anyio.to_thread.run_sync(_list_files)
            
            # Filter files based on modality
            files_to_download = self._filter_files_by_modality(files, state.payload.modality)
            
            if not files_to_download:
                # If no specific files found, download essential files
                files_to_download = [f for f in files if not f.startswith(".")][:10]  # Limit to 10 files
            
            total_files = len(files_to_download)
            downloaded = 0
            total_size = 0
            
            # Download each file
            for file_path in files_to_download:
                try:
                    def _download_file() -> str:
                        return hf_hub_download(
                            repo_id=repo_id,
                            filename=file_path,
                            cache_dir=str(model_dir),
                            token=settings.HUGGINGFACE_TOKEN,
                        )
                    
                    local_path = await anyio.to_thread.run_sync(_download_file)
                    downloaded += 1
                    state.progress = round(downloaded / total_files, 2)
                    
                    # Get file size
                    if os.path.exists(local_path):
                        total_size += os.path.getsize(local_path)
                    
                except Exception as e:
                    # Log error but continue with other files
                    print(f"Failed to download {file_path}: {e}")
            
            # Register the model in the database
            model = await ModelManagerService().download_model(
                state.payload,
                path=str(model_dir),
                size_bytes=total_size,
            )
            state.model_id = model.id
            state.status = DownloadStatus.completed
            state.progress = 1.0
            
        except Exception as exc:
            state.status = DownloadStatus.failed
            state.error = str(exc)

    def _filter_files_by_modality(self, files: list[str], modality: str) -> list[str]:
        """Filter repository files based on model modality."""
        filtered = []
        
        if modality == "text":
            # For LLMs, prioritize GGUF files or safetensors
            for pattern in [".gguf", ".safetensors", ".bin", "config.json", "tokenizer"]:
                filtered.extend([f for f in files if pattern in f.lower()])
        
        elif modality == "image":
            # For image models, get safetensors and config files
            for pattern in [".safetensors", ".ckpt", ".bin", "config.json", "model_index.json"]:
                filtered.extend([f for f in files if pattern in f.lower()])
        
        elif modality == "stt":
            # For STT models (Whisper), get .bin or .pt files
            for pattern in [".bin", ".pt", "config.json"]:
                filtered.extend([f for f in files if pattern in f.lower()])
        
        elif modality == "tts":
            # For TTS models, get model files and configs
            for pattern in [".pth", ".pt", ".onnx", "config.json"]:
                filtered.extend([f for f in files if pattern in f.lower()])
        
        elif modality == "video":
            # For video models, get safetensors and configs
            for pattern in [".safetensors", ".ckpt", "config.json"]:
                filtered.extend([f for f in files if pattern in f.lower()])
        
        # Remove duplicates while preserving order
        seen = set()
        result = []
        for f in filtered:
            if f not in seen:
                seen.add(f)
                result.append(f)
        
        return result


download_manager = DownloadManager()
