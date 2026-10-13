"""Portrait links. Staff paste Google Drive share links; those point at a
viewer page, not the image, so they're rewritten to a direct image URL."""

from __future__ import annotations

import re

_DRIVE_ID = [
    re.compile(r"drive\.google\.com/file/d/([\w-]+)"),
    re.compile(r"drive\.google\.com/(?:open|uc|thumbnail)\?(?:.*&)?id=([\w-]+)"),
    re.compile(r"docs\.google\.com/uc\?(?:.*&)?id=([\w-]+)"),
]


def normalize_image_url(url: str | None) -> str | None:
    """Drive share link → direct image link; other URLs unchanged. The Drive
    file must be shared as "Anyone with the link"."""
    if url is None:
        return None
    url = url.strip()
    if not url:
        return None
    for pattern in _DRIVE_ID:
        match = pattern.search(url)
        if match:
            return f"https://lh3.googleusercontent.com/d/{match.group(1)}=w400"
    return url
