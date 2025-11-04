from __future__ import annotations

from typing import Optional

from app.executors.base import BaseExecutor
from app.schemas.executors import ExecutorStatus
from app.schemas.models import LocalModel


class StableVideoDiffusionExecutor(BaseExecutor):
    name = "stable-video-diffusion"
    modality = "video"
    runtime_name = "svd"

    def __init__(self, *, auto_start: bool = False) -> None:
        super().__init__(auto_start=auto_start)
        self._loaded_model: Optional[str] = None

    async def load_model(self, model: LocalModel) -> None:
        self._loaded_model = str(model.id)

    async def get_status(self) -> ExecutorStatus:
        return ExecutorStatus(
            name=self.name,
            is_running=False,
            healthy=False,
            detail={"reason": "executor not yet connected"},
        )
