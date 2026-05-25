from pathlib import Path

from ato_pipeline.clean import clean_html, extract_title


FIXTURE = Path(__file__).parent / "fixtures" / "ato-page-sample.html"


def test_extract_title_from_fixture():
    html = FIXTURE.read_text()
    assert extract_title(html) == "Deductions you can claim"


def test_clean_strips_nav_script_style_footer():
    html = FIXTURE.read_text()
    cleaned = clean_html(html)
    assert "Site nav garbage" not in cleaned
    assert "tracking" not in cleaned
    assert "Commonwealth of Australia" not in cleaned
    assert "foo {}" not in cleaned


def test_clean_keeps_main_content():
    html = FIXTURE.read_text()
    cleaned = clean_html(html)
    assert "Deductions you can claim" in cleaned
    assert "Work-related expenses" in cleaned
    assert "Vehicle and travel expenses" in cleaned
    assert "Self-education expenses" in cleaned


def test_clean_preserves_heading_structure():
    html = FIXTURE.read_text()
    cleaned = clean_html(html)
    # h1 and h2 tags survive (we'll need them for heading-aware chunking)
    assert "<h1>" in cleaned.lower()
    assert "<h2>" in cleaned.lower()
