import numpy as np
import pytest

from ato_pipeline.embed import Embedder


@pytest.fixture(scope="module")
def embedder():
    return Embedder("sentence-transformers/all-MiniLM-L6-v2")


def test_embedder_returns_384d_vectors(embedder):
    vecs = embedder.encode(["hello world"])
    assert vecs.shape == (1, 384)
    assert vecs.dtype == np.float32


def test_embedder_normalises_to_unit_length(embedder):
    vecs = embedder.encode(["hello world", "another sentence about taxes"])
    norms = np.linalg.norm(vecs, axis=1)
    assert np.allclose(norms, 1.0, atol=1e-5)


def test_embedder_similar_texts_score_higher(embedder):
    texts = [
        "I can claim a deduction for work uniform expenses.",
        "Work uniform deductions reduce my taxable income.",
        "Lions live in the African savannah.",
    ]
    v = embedder.encode(texts)
    # cosine sim of normalised vecs = dot product
    sim_tax_tax = float(v[0] @ v[1])
    sim_tax_lion = float(v[0] @ v[2])
    assert sim_tax_tax > sim_tax_lion + 0.1
