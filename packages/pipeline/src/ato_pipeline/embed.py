from __future__ import annotations

from typing import Iterable

import numpy as np
from sentence_transformers import SentenceTransformer


class Embedder:
    """Wraps sentence-transformers for batch embedding with L2-normalisation."""

    def __init__(self, model_name: str, device: str = "cpu") -> None:
        self.model = SentenceTransformer(model_name, device=device)
        self.dim = self.model.get_sentence_embedding_dimension() or 0
        if self.dim != 384:
            raise RuntimeError(
                f"Expected 384-dim embeddings, got {self.dim} from {model_name}"
            )

    def encode(self, texts: Iterable[str], batch_size: int = 32) -> np.ndarray:
        vecs = self.model.encode(
            list(texts),
            batch_size=batch_size,
            normalize_embeddings=True,
            convert_to_numpy=True,
        )
        return vecs.astype(np.float32, copy=False)
