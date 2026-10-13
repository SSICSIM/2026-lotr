"""clear_region_flavour_text

Drops the placeholder status text seeded on every region. Only regions still
showing their seeded text are cleared, so statuses staff wrote are kept.

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-10-12 22:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SEEDED = {
    "lindon": "Elven havens; ships still sail West",
    "forodwaith": "Frozen wastes",
    "angmar": "Ruins of the Witch-realm",
    "arnor": "Empty lands of the lost kingdom",
    "the-shire": "Peaceful farmland",
    "bree-land": "Rangers watch the roads",
    "rhudaur": "Rivendell — sanctuary of Elrond",
    "cardolan": "Barrow-downs and empty fields",
    "enedwaith": "Hostile Dunlending clans",
    "misty-mountains": "Goblins in the deep; the Balrog stirs",
    "lothlorien": "The Golden Wood of Galadriel",
    "vales-of-anduin": "Beornings guard the river",
    "mirkwood": "Spiders and the shadow of Dol Guldur",
    "erebor": "Dwarves and Men of Dale",
    "brown-lands": "Barren, desolate country",
    "rhun": "Easterlings muster for Sauron",
    "fangorn": "Saruman's forges burn the forest",
    "rohan": "Horse-lords under King Théoden",
    "dead-marshes": "Lights of the dead beneath the water",
    "gondor": "Minas Tirith braces for war",
    "mount-doom": "Orodruin — the only fire that can unmake the Ring",
    "mordor": "The Eye of Sauron watches",
    "harad": "Haradrim march north",
}


def upgrade() -> None:
    bind = op.get_bind()
    for slug, status in _SEEDED.items():
        bind.execute(
            sa.text("UPDATE regions SET status = NULL WHERE slug = :slug AND status = :status"),
            {"slug": slug, "status": status},
        )


def downgrade() -> None:
    bind = op.get_bind()
    for slug, status in _SEEDED.items():
        bind.execute(
            sa.text("UPDATE regions SET status = :status WHERE slug = :slug AND status IS NULL"),
            {"slug": slug, "status": status},
        )
