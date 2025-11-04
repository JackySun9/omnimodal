from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, JSON
from sqlmodel import Field, SQLModel


class LocalModelRecord(SQLModel, table=True):
    __tablename__ = "local_models"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    name: str
    modality: str
    version: str | None = None
    path: str
    size_bytes: int | None = None
    model_metadata: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow),
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(
            DateTime(timezone=True),
            nullable=False,
            default=datetime.utcnow,
            onupdate=datetime.utcnow,
        ),
    )
