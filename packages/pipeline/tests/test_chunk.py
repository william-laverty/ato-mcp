from ato_pipeline.chunk import chunk_html


def test_chunk_returns_at_least_one_chunk():
    html = "<h1>Title</h1><p>Some body text.</p>"
    chunks = chunk_html(html, max_chars=500, overlap_chars=50)
    assert len(chunks) >= 1
    assert chunks[0].text.startswith("Title")


def test_chunk_preserves_heading_path_per_chunk():
    html = (
        "<h1>Deductions</h1>"
        "<h2>Work-related</h2>"
        "<p>Lots of body about work-related deductions.</p>"
        "<h2>Self-education</h2>"
        "<p>Lots of body about self-education deductions.</p>"
    )
    chunks = chunk_html(html, max_chars=500, overlap_chars=50)
    paths = [c.heading_path for c in chunks]
    assert ["Deductions", "Work-related"] in paths
    assert ["Deductions", "Self-education"] in paths


def test_chunk_splits_long_sections():
    body = ("Sentence one. Sentence two. Sentence three. " * 60)
    html = f"<h1>Title</h1><p>{body}</p>"
    chunks = chunk_html(html, max_chars=300, overlap_chars=50)
    assert len(chunks) >= 3
    # Every chunk under max_chars + small slop for sentence boundary
    for c in chunks:
        assert len(c.text) <= 360


def test_chunk_assigns_sequential_ord_within_doc():
    html = "<h1>A</h1><p>x</p><h2>B</h2><p>y</p>"
    chunks = chunk_html(html, max_chars=500, overlap_chars=50)
    for i, c in enumerate(chunks):
        assert c.ord == i
