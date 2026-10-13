"""Travelling groups and what each group knows about everyone else."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.crisis_note import Character
from app.models.map import Group, GroupMembership, GroupSighting, Movement
from app.schemas import LastSeen
from app.services.corruption import now_utc
from app.services.discovery import share_knowledge


def default_group(db: Session) -> Group | None:
    """New characters join the first group (the Fellowship everyone starts in)."""
    return db.query(Group).order_by(Group.id).first()


def assign(db: Session, character: Character, group_id: int | None, at: datetime | None = None) -> None:
    """Move a character into a group, recording when they left the old one."""
    if character.group_id == group_id:
        return
    at = at or now_utc()
    open_rows = (
        db.query(GroupMembership)
        .filter(GroupMembership.character_id == character.id, GroupMembership.left_at.is_(None))
        .all()
    )
    for row in open_rows:
        row.left_at = at
    character.group_id = group_id
    if group_id is not None:
        db.add(GroupMembership(character_id=character.id, group_id=group_id, joined_at=at))


def sync(db: Session, a: Group, b: Group, at: datetime | None = None) -> int:
    """Show each group where the other group's members are right now.

    A snapshot, not a live link: later moves stay hidden until the next sync.
    Returns how many sightings were recorded."""
    at = at or now_utc()
    count = 0
    for viewer, others in ((a, b), (b, a)):
        for c in others.members:
            if c.x is None or c.y is None:
                continue
            db.add(GroupSighting(viewer_group_id=viewer.id, character_id=c.id, x=c.x, y=c.y, seen_at=at))
            count += 1
    return count


def absorb(db: Session, source: Group, target: Group) -> None:
    """Fold ``source`` into ``target`` and delete it: its members, the lands
    it knew and what it had seen of others all carry over."""
    share_knowledge(db, [source.id], target.id)
    db.query(GroupSighting).filter(GroupSighting.viewer_group_id == source.id).update(
        {GroupSighting.viewer_group_id: target.id}
    )
    for character in list(source.members):
        assign(db, character, target.id)
    # Reload the (now empty) member list so deleting the group doesn't null
    # out the members' new group_id via the stale relationship.
    db.flush()
    db.expire(source, ["members"])
    db.delete(source)


def _position_at(movements: list[Movement], at: datetime) -> tuple[float, float] | None:
    """Where a character was at ``at``, from their (time-ordered) moves."""
    position = None
    for m in movements:
        if m.created_at > at:
            break
        position = (m.to_x, m.to_y)
    return position


def last_seen(db: Session, group: Group) -> list[LastSeen]:
    """For everyone outside ``group``: where they were the last time they
    travelled in the same group as any current member, or where the group
    was shown them by a sync — whichever is more recent.

    Characters the group never travelled with or synced with stay unknown.
    """
    now = now_utc()
    rows = db.query(GroupMembership).all()
    intervals: dict[int, list[tuple[int, datetime, datetime]]] = {}
    for r in rows:
        intervals.setdefault(r.character_id, []).append((r.group_id, r.joined_at, r.left_at or now))

    member_ids = {c.id for c in group.members}
    member_intervals = [iv for cid in member_ids for iv in intervals.get(cid, [])]

    sightings: dict[int, GroupSighting] = {}
    for s in (
        db.query(GroupSighting)
        .filter(GroupSighting.viewer_group_id == group.id)
        .order_by(GroupSighting.seen_at)
    ):
        sightings[s.character_id] = s  # latest wins

    result: list[LastSeen] = []
    outsiders = db.query(Character).filter(Character.id.notin_(member_ids) if member_ids else True).all()
    for other in outsiders:
        # Latest moment this character and any member were in the same group.
        together_until: datetime | None = None
        for gid, start, end in intervals.get(other.id, []):
            for mgid, mstart, mend in member_intervals:
                if gid == mgid and start < mend and mstart < end:
                    overlap_end = min(end, mend)
                    if together_until is None or overlap_end > together_until:
                        together_until = overlap_end
        sighting = sightings.get(other.id)
        if sighting is not None and (together_until is None or sighting.seen_at >= together_until):
            result.append(
                LastSeen(character_id=other.id, x=sighting.x, y=sighting.y, seen_at=sighting.seen_at)
            )
            continue
        if together_until is None:
            continue
        moves = (
            db.query(Movement)
            .filter(Movement.character_id == other.id)
            .order_by(Movement.created_at)
            .all()
        )
        position = _position_at(moves, together_until)
        if position is not None:
            result.append(
                LastSeen(character_id=other.id, x=position[0], y=position[1], seen_at=together_until)
            )
    return result
