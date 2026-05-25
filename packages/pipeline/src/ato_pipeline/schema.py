from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl


Source = Literal["ato", "legislation", "austlii", "state_revenue"]


class Doc(BaseModel):
    doc_id: str = Field(min_length=1)
    source: Source
    url: HttpUrl
    title: str
    jurisdiction: str = "AU"
    doc_type: str
    effective_from: str | None = None
    effective_to: str | None = None
    published_at: str | None = None
    retrieved_at: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class Chunk(BaseModel):
    chunk_id: str = Field(min_length=1)
    doc_id: str = Field(min_length=1)
    ord: int = Field(ge=0)
    text: str
    heading_path: list[str] = Field(default_factory=list)
    effective_from: str | None = None
    effective_to: str | None = None
    char_start: int = Field(ge=0)
    char_end: int = Field(ge=0)
