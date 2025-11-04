from uuid import UUID

from pydantic import BaseModel, Field


class ExecutorStatus(BaseModel):
    name: str
    is_running: bool
    healthy: bool
    detail: dict[str, object] = Field(default_factory=dict)


class ExecutorStatusResponse(BaseModel):
    executor: ExecutorStatus


class ExecutionRequest(BaseModel):
    model_id: UUID | None = None
    parameters: dict[str, object] = Field(default_factory=dict)
    payload: dict[str, object] = Field(default_factory=dict)


class ExecutionResponse(BaseModel):
    task_id: UUID | None = None
    result: dict[str, object] | None = None
    status: str
    metadata: dict[str, object] = Field(default_factory=dict)
