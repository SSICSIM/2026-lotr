"""Named places on the map, used for starting positions.

Coordinates are 0–1 fractions of the map image, like Character.x / .y.
"""

from __future__ import annotations

import json
import unicodedata
from functools import lru_cache
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.crisis_note import Character
from app.models.map import Movement, Region
from app.services.geo import region_at

_PLACES_JSON = Path(__file__).resolve().parents[1] / "data" / "places.json"
DEFAULT_PLACE = "Rivendell"


def _key(text: str) -> str:
    """Case-, accent- and punctuation-insensitive lookup key."""
    folded = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return "".join(ch for ch in folded if ch.isalnum())


@lru_cache
def _places() -> dict[str, tuple[float, float]]:
    out: dict[str, tuple[float, float]] = {}
    for place in json.loads(_PLACES_JSON.read_text(encoding="utf-8")):
        for name in [place["name"], *place.get("aliases", [])]:
            out[_key(name)] = (place["x"], place["y"])
    return out


def _point_in(region: Region, regions: list[Region]) -> tuple[float, float]:
    """A point that lands in ``region`` itself (not a smaller one nested in
    it), as close to its centre as possible."""
    xs = [p[0] for p in region.polygon]
    ys = [p[1] for p in region.polygon]
    cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
    steps = 40
    candidates = [
        (min(xs) + (max(xs) - min(xs)) * i / steps, min(ys) + (max(ys) - min(ys)) * j / steps)
        for i in range(steps + 1)
        for j in range(steps + 1)
    ]
    candidates.sort(key=lambda p: (p[0] - cx) ** 2 + (p[1] - cy) ** 2)
    for x, y in [(cx, cy), *candidates]:
        hit = region_at(regions, x, y)
        if hit is not None and hit.id == region.id:
            return x, y
    return cx, cy


def default_start() -> tuple[float, float]:
    return _places()[_key(DEFAULT_PLACE)]


def find_location(db: Session, text: str | None) -> tuple[float, float] | None:
    """A named place or region name → map point; None if nothing matches."""
    if not text or not text.strip():
        return None
    key = _key(text)
    if key in _places():
        return _places()[key]
    regions = db.query(Region).all()
    for region in regions:
        if key in (_key(region.name), _key(region.slug)):
            return _point_in(region, regions)
    return None


def place_character(db: Session, character: Character, x: float, y: float) -> None:
    """Put a character on the map for the first time.

    Also logs it as a movement so group sightings (last_seen) know where they
    started."""
    region = region_at(db.query(Region).all(), x, y)
    db.add(
        Movement(
            character_id=character.id,
            to_x=x,
            to_y=y,
            to_region_id=region.id if region else None,
        )
    )
    character.x = x
    character.y = y
