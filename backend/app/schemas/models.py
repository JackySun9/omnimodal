from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LocalModel(BaseModel):
    id: UUID
    name: str
    modality: str
    version: str | None = None
    path: str
    size_bytes: int | None = None
    model_metadata: dict[str, object] = Field(default_factory=dict)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class LocalModelCreateRequest(BaseModel):
    source_id: str
    modality: str
    executor: str
    auto_start: bool = False


class LocalModelListResponse(BaseModel):
    models: list[LocalModel]


class DownloadStatus(str, Enum):
    queued = "queued"
    downloading = "downloading"
    completed = "completed"
    failed = "failed"


class DownloadTask(BaseModel):
    task_id: UUID
    source_id: str
    modality: str
    executor: str
    status: DownloadStatus
    progress: float = 0.0
    error: str | None = None
    model_id: UUID | None = None


class DownloadTaskListResponse(BaseModel):
    items: list[DownloadTask]


class ModelSearchFilters(BaseModel):
    query: str | None = None
    task: str | None = None
    limit: int = 20
    include_compatibility: bool = True  # Include hardware compatibility scoring


class DiscoveredModel(BaseModel):
    repo_id: str
    name: str | None = None
    task: str | None = None
    likes: int | None = None
    tags: list[str] = Field(default_factory=list)
    siblings: list[str] = Field(default_factory=list)
    card_data: dict[str, object] = Field(default_factory=dict)
    downloads: int | None = None
    compatibility: dict[str, object] | None = None  # Hardware compatibility info


class ModelSearchResponse(BaseModel):
    items: list[DiscoveredModel]
