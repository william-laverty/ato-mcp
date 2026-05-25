import pytest
from pydantic import ValidationError
from ato_pipeline.schema import Doc, Chunk


def test_doc_valid():
    doc = Doc(
        doc_id="ato:individuals/deductions",
        source="ato",
        url="https://www.ato.gov.au/individuals/deductions",
        title="Deductions you can claim",
        doc_type="ATO_GUIDE",
        retrieved_at="2026-05-25T00:00:00Z",
    )
    assert doc.doc_id == "ato:individuals/deductions"
    assert doc.jurisdiction == "AU"
    assert doc.metadata == {}


def test_doc_rejects_bad_source():
    with pytest.raises(ValidationError):
        Doc(
            doc_id="x",
            source="not-a-source",
            url="https://x",
            title="t",
            doc_type="x",
            retrieved_at="2026-05-25T00:00:00Z",
        )


def test_chunk_valid():
    chunk = Chunk(
        chunk_id="ato:individuals/deductions#0",
        doc_id="ato:individuals/deductions",
        ord=0,
        text="Hello",
        heading_path=["Deductions"],
        char_start=0,
        char_end=5,
    )
    assert chunk.ord == 0
