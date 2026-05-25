"""Abstract base class for corpus sources."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from ..schema import Chunk, Doc


@dataclass
class SourceOutput:
    """Unified output container from a corpus source."""

    docs: list[Doc]
    chunks: list[Chunk]
    anchors: list[dict[str, Any]] = field(default_factory=list)
    citations: list[dict[str, Any]] = field(default_factory=list)
    definitions: list[dict[str, Any]] = field(default_factory=list)
    thresholds: list[dict[str, Any]] = field(default_factory=list)


class Source(ABC):
    """Abstract base for a corpus source.

    Each implementation fetches content, produces Doc/Chunk rows,
    and optionally populates the auxiliary tables (anchors, definitions,
    thresholds, citations).
    """

    name: str

    @abstractmethod
    async def fetch(self) -> SourceOutput:
        ...
