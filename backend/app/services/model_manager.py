from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlmodel import select

from app.core.db import get_session
from app.models.local_model import LocalModelRecord
from app.schemas.models import LocalModel, LocalModelCreateRequest


class ModelManagerService:
    async def list_local_models(self) -> list[LocalModel]:
        async for session in get_session():
            result = await session.exec(select(LocalModelRecord))
            records = result.all()
            return [LocalModel.model_validate(record) for record in records]
        return []

    async def download_model(
        self,
        payload: LocalModelCreateRequest,
        path: str | None = None,
        size_bytes: int | None = None,
    ) -> LocalModel:
        """Create a local model record after download."""
        metadata: dict[str, Any] = {
            "executor": payload.executor,
            "auto_start": payload.auto_start,
        }
        
        # Use provided path or generate default
        model_path = path or f"/models/{payload.source_id}"
        
        record = LocalModelRecord(
            name=payload.source_id,
            modality=payload.modality,
            version=None,
            path=model_path,
            size_bytes=size_bytes,
            model_metadata=metadata,
        )
        async for session in get_session():
            session.add(record)
            await session.commit()
            await session.refresh(record)
            return LocalModel.model_validate(record)
        raise RuntimeError("Failed to create model record")

    async def delete_model(self, model_id: UUID) -> None:
        async for session in get_session():
            record = await session.get(LocalModelRecord, model_id)
            if record is not None:
                await session.delete(record)
                await session.commit()
            return
