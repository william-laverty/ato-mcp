import httpx
import pytest
import respx

from ato_pipeline.config import PipelineConfig
from ato_pipeline.scrape import (
    canonical_doc_id,
    discover_links_from_page,
    fetch_page,
    fetch_sitemap_urls,
)


@respx.mock
@pytest.mark.asyncio
async def test_fetch_page_returns_html_text():
    url = "https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim"
    respx.get(url).mock(return_value=httpx.Response(200, text="<html>hi</html>"))
    async with httpx.AsyncClient() as client:
        html, status = await fetch_page(client, url)
    assert status == 200
    assert "<html>" in html


@respx.mock
@pytest.mark.asyncio
async def test_fetch_page_returns_status_on_404():
    url = "https://www.ato.gov.au/missing"
    respx.get(url).mock(return_value=httpx.Response(404, text=""))
    async with httpx.AsyncClient() as client:
        html, status = await fetch_page(client, url)
    assert status == 404
    assert html == ""


def test_canonical_doc_id_from_url():
    url = "https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim"
    assert canonical_doc_id(url) == "ato:individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim"


def test_canonical_doc_id_strips_query_and_fragment():
    url = "https://www.ato.gov.au/some/path?foo=bar#anchor"
    assert canonical_doc_id(url) == "ato:some/path"


@respx.mock
@pytest.mark.asyncio
async def test_fetch_sitemap_urls_filters_to_include_prefixes():
    sitemap_xml = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.ato.gov.au/individuals-and-families/deductions/uniform</loc></url>
  <url><loc>https://www.ato.gov.au/individuals-and-families/deductions/uniform</loc></url>
  <url><loc>https://www.ato.gov.au/businesses-and-organisations/gst/register</loc></url>
  <url><loc>https://www.ato.gov.au/forms-and-instructions/trust-tax-return</loc></url>
  <url><loc>https://www.ato.gov.au/about-ato/contact-us</loc></url>
  <url><loc>https://www.ato.gov.au/careers/grad-program</loc></url>
  <url><loc>https://www.ato.gov.au/media-centre/press-release</loc></url>
</urlset>"""
    respx.get("https://www.ato.gov.au/sitemap.xml").mock(
        return_value=httpx.Response(200, text=sitemap_xml)
    )
    cfg = PipelineConfig()
    urls = await fetch_sitemap_urls(cfg)
    assert "https://www.ato.gov.au/individuals-and-families/deductions/uniform" in urls
    assert "https://www.ato.gov.au/businesses-and-organisations/gst/register" in urls
    assert "https://www.ato.gov.au/forms-and-instructions/trust-tax-return" in urls
    # Excluded sections
    assert not any("/about-ato/" in u for u in urls)
    assert not any("/careers/" in u for u in urls)
    assert not any("/media-centre/" in u for u in urls)
    # No duplicates
    assert len(urls) == len(set(urls))


def test_discover_links_from_page_keeps_same_host_only():
    html = """
      <html><body>
        <a href="https://www.ato.gov.au/internal-page">Keep</a>
        <a href="https://www.ato.gov.au/another?utm=1">Keep</a>
        <a href="https://example.com/external">Drop</a>
        <a href="mailto:x@y">Drop</a>
        <a href="#in-page">Drop</a>
      </body></html>
    """
    base = "https://www.ato.gov.au/start"
    links = discover_links_from_page(html, base)
    assert "https://www.ato.gov.au/internal-page" in links
    assert "https://www.ato.gov.au/another" in links
    assert all("example.com" not in l for l in links)
    assert all("mailto" not in l for l in links)
