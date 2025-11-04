from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any
from uuid import UUID

from app.schemas.executors import ExecutionRequest, ExecutionResponse, ExecutorStatus
from app.schemas.models import LocalModel


class BaseExecutor(ABC):
    name: str
    modality: str
    runtime_name: str

    def __init__(self, *, auto_start: bool = False) -> None:
        self.auto_start = auto_start

    @abstractmethod
    async def load_model(self, model: LocalModel) -> None:
        raise NotImplementedError

    @abstractmethod
    async def get_status(self) -> ExecutorStatus:
        raise NotImplementedError

    async def unload_model(self, model_id: UUID) -> None:
        raise NotImplementedError

    async def execute(self, request: ExecutionRequest) -> ExecutionResponse:
        raise NotImplementedError

    async def generate_text(self, params: dict[str, Any]) -> ExecutionResponse:
        raise NotImplementedError

    async def generate_image(self, params: dict[str, Any]) -> ExecutionResponse:
        raise NotImplementedError

    async def speech_to_text(self, params: dict[str, Any]) -> ExecutionResponse:
        raise NotImplementedError

    async def text_to_speech(self, params: dict[str, Any]) -> ExecutionResponse:
        raise NotImplementedError

    async def text_to_video(self, params: dict[str, Any]) -> ExecutionResponse:
        raise NotImplementedError
