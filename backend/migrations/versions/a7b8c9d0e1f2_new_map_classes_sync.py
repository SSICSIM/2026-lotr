"""new_map_classes_sync

- New map artwork: region outlines are redrawn (from app/data/regions.json)
  and every stored position is carried over from the old map to the same
  place on the new one.
- Characters without a position start in Rivendell.
- Four character classes: Men, Elves, Dwarves, Wizards & Hobbits.
- Group sync snapshots (group_sightings).
- Custom crisis note actions and custom conflict outcomes.

Downgrade drops the schema additions but can't move positions back onto the
old map (that artwork is gone).

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-10-12 21:00:00.000000

"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_REGIONS_JSON = Path(__file__).resolve().parents[2] / "app" / "data" / "regions.json"

RIVENDELL = (0.5, 0.265)

# The same landmarks on the old map → the new map (0–1 fractions). Positions
# are carried over with a least-squares affine fit, then nudged by the
# inverse-distance-weighted leftover error so landmarks land exactly.
_LANDMARKS = [
    ((0.487, 0.268), (0.500, 0.265)),  # Rivendell
    ((0.368, 0.286), (0.344, 0.282)),  # Bree
    ((0.316, 0.278), (0.276, 0.278)),  # Hobbiton
    ((0.253, 0.276), (0.205, 0.268)),  # Grey Havens
    ((0.357, 0.211), (0.331, 0.213)),  # Fornost
    ((0.396, 0.407), (0.383, 0.392)),  # Tharbad
    ((0.407, 0.091), (0.416, 0.093)),  # Carn Dûm
    ((0.6245, 0.170), (0.679, 0.167)),  # Erebor
    ((0.626, 0.199), (0.679, 0.186)),  # Dale
    ((0.461, 0.390), (0.468, 0.390)),  # Moria
    ((0.578, 0.419), (0.600, 0.405)),  # Dol Guldur
    ((0.802, 0.431), (0.905, 0.425)),  # Sea of Rhûn
    ((0.494, 0.642), (0.503, 0.615)),  # Edoras
    ((0.481, 0.615), (0.480, 0.597)),  # Helm's Deep
    ((0.602, 0.716), (0.650, 0.680)),  # Minas Tirith
    ((0.659, 0.686), (0.7195, 0.660)),  # Mount Doom
    ((0.633, 0.625), (0.688, 0.597)),  # Morannon
    ((0.740, 0.814), (0.824, 0.770)),  # Sea of Núrnen
    ((0.499, 0.780), (0.494, 0.773)),  # Dol Amroth
    ((0.448, 0.540), (0.440, 0.525)),  # Isengard
]


def _solve3(m: list[list[float]], v: list[float]) -> list[float]:
    a = [row[:] + [v[i]] for i, row in enumerate(m)]
    for c in range(3):
        p = max(range(c, 3), key=lambda r: abs(a[r][c]))
        a[c], a[p] = a[p], a[c]
        for r in range(3):
            if r != c:
                f = a[r][c] / a[c][c]
                a[r] = [x - f * y for x, y in zip(a[r], a[c])]
    return [a[i][3] / a[i][i] for i in range(3)]


def _affine_fit() -> tuple[list[float], list[float]]:
    ata = [[0.0] * 3 for _ in range(3)]
    atx = [0.0] * 3
    aty = [0.0] * 3
    for (x, y), (nx, ny) in _LANDMARKS:
        row = [x, y, 1.0]
        for i in range(3):
            for j in range(3):
                ata[i][j] += row[i] * row[j]
            atx[i] += row[i] * nx
            aty[i] += row[i] * ny
    return _solve3(ata, atx), _solve3(ata, aty)


_AX, _AY = _affine_fit()


def _affine(x: float, y: float) -> tuple[float, float]:
    return _AX[0] * x + _AX[1] * y + _AX[2], _AY[0] * x + _AY[1] * y + _AY[2]


_RESIDUALS = [
    (old, (new[0] - _affine(*old)[0], new[1] - _affine(*old)[1])) for old, new in _LANDMARKS
]


def _to_new_map(x: float, y: float) -> tuple[float, float]:
    ax, ay = _affine(x, y)
    wsum = dx = dy = 0.0
    for (ox, oy), (rx, ry) in _RESIDUALS:
        d2 = (x - ox) ** 2 + (y - oy) ** 2
        if d2 < 1e-12:
            dx, dy, wsum = rx, ry, 1.0
            break
        w = 1.0 / d2
        wsum += w
        dx += w * rx
        dy += w * ry
    return (
        min(1.0, max(0.0, ax + dx / wsum)),
        min(1.0, max(0.0, ay + dy / wsum)),
    )


def _contains(polygon: list[list[float]], x: float, y: float) -> bool:
    inside = False
    n = len(polygon)
    for i in range(n):
        x1, y1 = polygon[i]
        x2, y2 = polygon[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def _area(polygon: list[list[float]]) -> float:
    n = len(polygon)
    return abs(
        sum(
            polygon[i][0] * polygon[(i + 1) % n][1] - polygon[(i + 1) % n][0] * polygon[i][1]
            for i in range(n)
        )
    ) / 2


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE note_action_enum ADD VALUE IF NOT EXISTS 'CUSTOM'")

    op.add_column("crisis_notes", sa.Column("custom_action", sa.String(255), nullable=True))
    op.add_column("conflicts", sa.Column("outcome_label", sa.String(255), nullable=True))
    op.create_table(
        "group_sightings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "viewer_group_id",
            sa.Integer(),
            sa.ForeignKey("groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "character_id",
            sa.Integer(),
            sa.ForeignKey("characters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("x", sa.Float(), nullable=False),
        sa.Column("y", sa.Float(), nullable=False),
        sa.Column(
            "seen_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_group_sightings_viewer_group_id", "group_sightings", ["viewer_group_id"])

    bind = op.get_bind()

    # Four classes. Anyone already corrupted keeps their old curve so their
    # corruption doesn't jump.
    old_curve = {"HOBBIT": 0.5, "WIZARD": 0.8, "ELF": 1.0, "DWARF": 1.2, "MAN": 1.5, "ORC": 2.0, "OTHER": 1.0}
    holder = bind.execute(sa.text("SELECT ring_holder_id FROM game_state WHERE id = 1")).scalar()
    for cid, race, a, hours in bind.execute(
        sa.text("SELECT id, race, corruption_a, ring_hours FROM characters")
    ).all():
        new_race = {"HOBBIT": "WIZARD_HOBBIT", "WIZARD": "WIZARD_HOBBIT", "ELF": "ELF", "DWARF": "DWARF"}.get(
            race, "MAN"
        )
        if new_race == race:
            continue
        if a is None and (hours or cid == holder):
            a = old_curve.get(race, 1.0)
        bind.execute(
            sa.text("UPDATE characters SET race = :race, corruption_a = :a WHERE id = :id"),
            {"race": new_race, "a": a, "id": cid},
        )

    # New outlines.
    regions = json.loads(_REGIONS_JSON.read_text(encoding="utf-8"))
    for r in regions:
        bind.execute(
            sa.text("UPDATE regions SET polygon = CAST(:polygon AS JSON) WHERE slug = :slug"),
            {"polygon": json.dumps(r["polygon"]), "slug": r["slug"]},
        )
    outlines = [
        (rid, polygon if isinstance(polygon, list) else json.loads(polygon))
        for rid, polygon in bind.execute(sa.text("SELECT id, polygon FROM regions")).all()
    ]

    def region_id(x: float | None, y: float | None) -> int | None:
        if x is None or y is None:
            return None
        hits = [(rid, p) for rid, p in outlines if _contains(p, x, y)]
        return min(hits, key=lambda h: _area(h[1]))[0] if hits else None

    # Carry positions over to the new map.
    for cid, x, y in bind.execute(
        sa.text("SELECT id, x, y FROM characters WHERE x IS NOT NULL AND y IS NOT NULL")
    ).all():
        nx, ny = _to_new_map(x, y)
        bind.execute(
            sa.text("UPDATE characters SET x = :x, y = :y WHERE id = :id"),
            {"x": nx, "y": ny, "id": cid},
        )
    for mid, fx, fy, tx, ty in bind.execute(
        sa.text("SELECT id, from_x, from_y, to_x, to_y FROM movements")
    ).all():
        fx, fy = _to_new_map(fx, fy) if fx is not None and fy is not None else (None, None)
        tx, ty = _to_new_map(tx, ty)
        bind.execute(
            sa.text(
                "UPDATE movements SET from_x = :fx, from_y = :fy, to_x = :tx, to_y = :ty, "
                "from_region_id = :fr, to_region_id = :tr WHERE id = :id"
            ),
            {
                "fx": fx,
                "fy": fy,
                "tx": tx,
                "ty": ty,
                "fr": region_id(fx, fy),
                "tr": region_id(tx, ty),
                "id": mid,
            },
        )

    # Everyone not yet on the map starts in Rivendell.
    x, y = RIVENDELL
    for (cid,) in bind.execute(sa.text("SELECT id FROM characters WHERE x IS NULL OR y IS NULL")).all():
        bind.execute(
            sa.text("UPDATE characters SET x = :x, y = :y WHERE id = :id"), {"x": x, "y": y, "id": cid}
        )
        bind.execute(
            sa.text(
                "INSERT INTO movements (character_id, to_x, to_y, to_region_id) "
                "VALUES (:id, :x, :y, :r)"
            ),
            {"id": cid, "x": x, "y": y, "r": region_id(x, y)},
        )


def downgrade() -> None:
    op.execute("UPDATE crisis_notes SET action = 'NONE' WHERE action = 'CUSTOM'")
    op.drop_index("ix_group_sightings_viewer_group_id", table_name="group_sightings")
    op.drop_table("group_sightings")
    op.drop_column("conflicts", "outcome_label")
    op.drop_column("crisis_notes", "custom_action")
    # Postgres can't drop an enum value; 'CUSTOM' stays on note_action_enum.
    op.execute("UPDATE characters SET race = 'HOBBIT' WHERE race = 'WIZARD_HOBBIT'")
