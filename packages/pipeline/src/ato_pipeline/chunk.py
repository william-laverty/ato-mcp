from __future__ import annotations

import re
from dataclasses import dataclass, field

from selectolax.parser import HTMLParser, Node


_HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
_BLOCK_TAGS = {"p", "li", "td", "th", "blockquote", "pre"}


@dataclass
class ChunkRaw:
    ord: int
    text: str
    heading_path: list[str] = field(default_factory=list)
    char_start: int = 0
    char_end: int = 0


def _heading_level(tag: str) -> int:
    return int(tag[1])


def _walk_text_blocks(root: Node) -> list[tuple[list[str], str]]:
    """Walk the DOM and emit (heading_path, text_block) tuples in document order."""
    out: list[tuple[list[str], str]] = []
    heading_stack: list[tuple[int, str]] = []  # (level, text)

    def visit(node: Node) -> None:
        tag = (node.tag or "").lower()
        if tag in _HEADING_TAGS:
            level = _heading_level(tag)
            # Pop any deeper-or-equal heading
            while heading_stack and heading_stack[-1][0] >= level:
                heading_stack.pop()
            heading_text = node.text(separator=" ", strip=True)
            if heading_text:
                heading_stack.append((level, heading_text))
                # Emit the heading itself as a text block so it appears in the chunk
                out.append(([h[1] for h in heading_stack], heading_text))
            return
        if tag in _BLOCK_TAGS:
            text = node.text(separator=" ", strip=True)
            if text:
                out.append(([h[1] for h in heading_stack], text))
            return
        for child in node.iter():
            visit(child)

    for child in root.iter():
        visit(child)
    return out


def _split_long_text(text: str, max_chars: int) -> list[str]:
    """Split a long block into sentence-grouped pieces under max_chars."""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    pieces: list[str] = []
    current = ""
    for s in sentences:
        if not s:
            continue
        if current and len(current) + 1 + len(s) > max_chars:
            pieces.append(current)
            current = s
        else:
            current = f"{current} {s}".strip() if current else s
    if current:
        pieces.append(current)
    return pieces


def chunk_html(
    html: str, *, max_chars: int = 1800, overlap_chars: int = 200
) -> list[ChunkRaw]:
    """Heading-aware chunker. Each chunk carries its parent heading_path."""
    tree = HTMLParser(html)
    root = tree.body or tree.root
    if root is None:
        return []
    blocks = _walk_text_blocks(root)
    if not blocks:
        return []

    chunks: list[ChunkRaw] = []
    cursor_chars = 0

    # Group consecutive blocks under the same heading_path until they exceed max_chars.
    buffer_text = ""
    buffer_path: list[str] = []
    for path, block_text in blocks:
        if not buffer_text:
            buffer_path = path
            buffer_text = block_text
            continue

        same_path = path == buffer_path
        candidate = f"{buffer_text}\n\n{block_text}" if same_path else None

        if same_path and candidate is not None and len(candidate) <= max_chars:
            buffer_text = candidate
            continue

        # Flush
        for piece in _split_long_text(buffer_text, max_chars):
            chunks.append(
                ChunkRaw(
                    ord=len(chunks),
                    text=piece,
                    heading_path=list(buffer_path),
                    char_start=cursor_chars,
                    char_end=cursor_chars + len(piece),
                )
            )
            cursor_chars += len(piece)
        buffer_path = path
        buffer_text = block_text

    if buffer_text:
        for piece in _split_long_text(buffer_text, max_chars):
            chunks.append(
                ChunkRaw(
                    ord=len(chunks),
                    text=piece,
                    heading_path=list(buffer_path),
                    char_start=cursor_chars,
                    char_end=cursor_chars + len(piece),
                )
            )
            cursor_chars += len(piece)

    return chunks
