"""staff_feedback_round2

- Crisis periods get a description (the published crisis update).
- Wizards and Hobbits become separate classes. Existing "Wizards & Hobbits"
  characters become Hobbits; staff re-class the wizards by hand.
- Staff (CAs) and their assigned characters.
- Crisis-controlled characters (NPCs / enemy forces).
- CRISIS_NOTE note type.

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-10-19 12:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c9d0e1f2a3b4"
down_revision: Union[str, None] = "b8c9d0e1f2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("crisis_periods", sa.Column("description", sa.Text(), nullable=True))

    op.execute("UPDATE characters SET race = 'HOBBIT' WHERE race = 'WIZARD_HOBBIT'")

    op.add_column(
        "characters",
        sa.Column("crisis_controlled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    op.create_table(
        "staff",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "character_staff",
        sa.Column(
            "character_id",
            sa.Integer(),
            sa.ForeignKey("characters.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "staff_id", sa.Integer(), sa.ForeignKey("staff.id", ondelete="CASCADE"), primary_key=True
        ),
    )

    # ADD VALUE can't run inside a transaction block on older Postgres.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE note_type_enum ADD VALUE IF NOT EXISTS 'CRISIS_NOTE'")


def downgrade() -> None:
    # Postgres can't drop an enum value; fold the notes back into updates.
    op.execute("UPDATE crisis_notes SET note_type = 'CRISIS_UPDATE' WHERE note_type = 'CRISIS_NOTE'")
    op.drop_table("character_staff")
    op.drop_table("staff")
    op.drop_column("characters", "crisis_controlled")
    op.execute("UPDATE characters SET race = 'WIZARD_HOBBIT' WHERE race IN ('WIZARD', 'HOBBIT')")
    op.drop_column("crisis_periods", "description")
