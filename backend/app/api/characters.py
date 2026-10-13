from __future__ import annotations

import csv
import io
import json
from dataclasses import dataclass
from datetime import datetime

import openpyxl
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.crisis_note import Character, CrisisNote, NoteAction
from app.models.map import ConflictStatus, GameState, Movement, Region
from app.schemas import (
    BulkUploadResult,
    CharacterCreate,
    CharacterResponse,
    CharacterUpdate,
    MapCharacterResponse,
    MovementResponse,
    MoveRequest,
)
from app.services import corruption
from app.services.avatars import normalize_image_url
from app.services.game import load_game_state
from app.services.geo import region_at
from app.services.discovery import set_discovered
from app.services.groups import assign, default_group
from app.services.notes import active_period
from app.services.places import default_start, find_location, place_character

router = APIRouter(prefix="/characters", tags=["characters"])


def _to_map_character(
    c: Character, game: GameState, regions: list[Region], at: datetime
) -> MapCharacterResponse:
    region = region_at(regions, c.x, c.y)
    return MapCharacterResponse(
        id=c.id,
        name=c.name,
        created_at=c.created_at,
        race=c.race,
        avatar_url=c.avatar_url,
        x=c.x,
        y=c.y,
        region_id=region.id if region else None,
        army_mobilized=c.army_mobilized,
        has_ring=game.ring_holder_id == c.id,
        group_id=c.group_id,
        corruption=corruption.current(c, game, at),
        corruption_a=corruption.curve_a(c),
        corruption_a_is_custom=c.corruption_a is not None,
        ring_hours=corruption.hours_held(c, game, at),
        accruing=corruption.is_accruing(c, game),
        corruption_rate_per_hour=corruption.rate_per_hour(c, game, at),
        as_of=at,
        ongoing_conflict_ids=[k.id for k in c.conflicts if k.status == ConflictStatus.ONGOING],
    )


def _get_character(db: Session, character_id: int) -> Character:
    character = db.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found.")
    return character


def _map_character(db: Session, character: Character) -> MapCharacterResponse:
    return _to_map_character(
        character, load_game_state(db), db.query(Region).all(), corruption.now_utc()
    )


@router.get("", response_model=list[MapCharacterResponse])
def list_characters(db: Session = Depends(get_db)) -> list[MapCharacterResponse]:
    game = load_game_state(db)
    regions = db.query(Region).all()
    at = corruption.now_utc()
    characters = (
        db.query(Character)
        .options(selectinload(Character.conflicts))
        .order_by(Character.name)
        .all()
    )
    return [_to_map_character(c, game, regions, at) for c in characters]


@router.get("/{character_id}", response_model=MapCharacterResponse)
def get_character(character_id: int, db: Session = Depends(get_db)) -> MapCharacterResponse:
    return _map_character(db, _get_character(db, character_id))


@router.patch("/{character_id}", response_model=MapCharacterResponse)
def update_character(
    character_id: int, body: CharacterUpdate, db: Session = Depends(get_db)
) -> MapCharacterResponse:
    character = _get_character(db, character_id)
    updates = body.model_dump(exclude_unset=True)
    if updates.get("race") is not None:
        race = corruption.normalize_class(updates["race"])
        if race is None:
            raise HTTPException(
                status_code=422, detail=f"Class must be one of: {', '.join(corruption.RACES)}."
            )
        updates["race"] = race
    if "avatar_url" in updates:
        updates["avatar_url"] = normalize_image_url(updates["avatar_url"])
    game = load_game_state(db)
    race = updates.pop("race", None)
    if race is not None or "corruption_a" in updates:
        # A new curve keeps today's corruption; only the future rise changes.
        a = updates.pop("corruption_a") if "corruption_a" in updates else character.corruption_a
        corruption.set_curve(character, game, a, race)
    value = updates.pop("corruption", None)
    if value is not None:
        corruption.set_value(character, game, value)
    for field, value in updates.items():
        if value is not None or field == "avatar_url":
            setattr(character, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A character with that name already exists.")
    db.refresh(character)
    return _map_character(db, character)


@router.post("/{character_id}/move", response_model=MapCharacterResponse)
def move_character(
    character_id: int, body: MoveRequest, db: Session = Depends(get_db)
) -> MapCharacterResponse:
    character = _get_character(db, character_id)
    if body.override:
        if body.note_id is not None or body.note is not None:
            raise HTTPException(
                status_code=422, detail="An override move doesn't take a crisis note."
            )
    elif (body.note_id is None) == (body.note is None):
        raise HTTPException(
            status_code=422,
            detail="A move needs a crisis note: pick an existing note or write a new one.",
        )

    # Override moves go through without a crisis note.
    note: CrisisNote | None = None
    if body.note_id is not None:
        note = db.get(CrisisNote, body.note_id)
        if not note:
            raise HTTPException(status_code=404, detail="Note not found.")
    elif body.note is not None:
        note = CrisisNote(
            character_id=character.id,
            period_id=active_period(db).id,
            title=body.note.title,
            description=body.note.description,
            priority=body.note.priority,
            note_type=body.note.note_type,
            action=NoteAction.MOVE,
        )
        db.add(note)
        db.flush()

    regions = db.query(Region).all()
    from_region = region_at(regions, character.x, character.y)
    to_region = region_at(regions, body.x, body.y)
    if body.discover_region and to_region is not None:
        # Discovered by the mover's own group only; other groups stay in the dark.
        group_id = character.group_id
        if group_id is None:
            fallback = default_group(db)
            group_id = fallback.id if fallback else None
        if group_id is not None:
            set_discovered(db, to_region.id, group_id, True)

    db.add(
        Movement(
            character_id=character.id,
            from_x=character.x,
            from_y=character.y,
            to_x=body.x,
            to_y=body.y,
            from_region_id=from_region.id if from_region else None,
            to_region_id=to_region.id if to_region else None,
            note_id=note.id if note else None,
        )
    )
    character.x = body.x
    character.y = body.y
    db.commit()
    db.refresh(character)
    return _map_character(db, character)


@router.get("/{character_id}/movements", response_model=list[MovementResponse])
def list_movements(character_id: int, db: Session = Depends(get_db)) -> list[MovementResponse]:
    _get_character(db, character_id)
    movements = (
        db.query(Movement)
        .options(
            selectinload(Movement.from_region),
            selectinload(Movement.to_region),
            selectinload(Movement.note),
        )
        .filter(Movement.character_id == character_id)
        .order_by(Movement.created_at.desc())
        .all()
    )
    return [
        MovementResponse(
            id=m.id,
            character_id=m.character_id,
            from_x=m.from_x,
            from_y=m.from_y,
            to_x=m.to_x,
            to_y=m.to_y,
            from_region_name=m.from_region.name if m.from_region else None,
            to_region_name=m.to_region.name if m.to_region else None,
            note_id=m.note_id,
            note_title=m.note.title if m.note else None,
            created_at=m.created_at,
        )
        for m in movements
    ]


@router.post("", response_model=CharacterResponse, status_code=status.HTTP_201_CREATED)
def create_character(body: CharacterCreate, db: Session = Depends(get_db)) -> Character:
    existing = db.query(Character).filter(Character.name == body.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="A character with that name already exists.")
    character = Character(name=body.name)
    db.add(character)
    try:
        db.flush()
        # Everyone starts in Rivendell, in the starting group.
        place_character(db, character, *default_start())
        group = default_group(db)
        if group is not None:
            assign(db, character, group.id)
        db.commit()
    except IntegrityError:
        # Another request created the same name between our check and commit.
        db.rollback()
        raise HTTPException(status_code=409, detail="A character with that name already exists.")
    db.refresh(character)
    return character


# Character sheet columns, in the order used when the sheet has no header row.
_SHEET_COLUMNS = ["name", "class", "a", "location", "image"]
_HEADER_ALIASES = {
    "name": ["name", "character", "charactername"],
    "class": ["class", "race", "type"],
    "a": ["a", "avalue", "curve", "corruptiona", "corruption"],
    "location": ["location", "startlocation", "start", "startinglocation", "place"],
    "image": ["image", "imagelink", "imageurl", "portrait", "avatar", "photo", "picture", "link"],
}


@dataclass
class _SheetRow:
    line: int
    values: dict[str, str]


def _header_key(cell: object) -> str | None:
    text = "".join(ch for ch in str(cell or "").lower() if ch.isalnum())
    return next((col for col, aliases in _HEADER_ALIASES.items() if text in aliases), None)


def _sheet_rows(table: list[list[object]]) -> list[_SheetRow]:
    """Rows as {column: text}. A first row naming a "name" column is a
    header; otherwise columns follow _SHEET_COLUMNS."""
    table = [row for row in table if any(str(c or "").strip() for c in row)]
    if not table:
        return []
    columns: list[str | None] = list(_SHEET_COLUMNS)
    first = 0
    header = [_header_key(c) for c in table[0]]
    if "name" in header:
        columns, first = header, 1
    rows = []
    for i, row in enumerate(table[first:], start=first + 1):
        values = {
            col: str(cell).strip()
            for col, cell in zip(columns, row)
            if col is not None and cell is not None and str(cell).strip()
        }
        rows.append(_SheetRow(line=i, values=values))
    return rows


def _read_sheet(filename: str, content: bytes) -> list[_SheetRow]:
    if filename.endswith(".json"):
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            raise HTTPException(status_code=422, detail="That file is not valid JSON.")
        if not isinstance(data, list):
            raise HTTPException(status_code=422, detail="The JSON must be a list of characters.")
        rows = []
        for i, item in enumerate(data, start=1):
            if isinstance(item, str):
                rows.append(_SheetRow(line=i, values={"name": item.strip()}))
            elif isinstance(item, dict):
                values = {}
                for key, value in item.items():
                    col = _header_key(key)
                    if col and value is not None and str(value).strip():
                        values[col] = str(value).strip()
                rows.append(_SheetRow(line=i, values=values))
        return rows
    if filename.endswith(".csv"):
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise HTTPException(status_code=422, detail="The CSV must be UTF-8 text.")
        return _sheet_rows([list(r) for r in csv.reader(io.StringIO(text))])
    if filename.endswith(".xlsx"):
        try:
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        except Exception:
            raise HTTPException(status_code=422, detail="That file is not a valid .xlsx workbook.")
        ws = wb.active
        return _sheet_rows([list(r) for r in ws.iter_rows(values_only=True)]) if ws else []
    raise HTTPException(status_code=422, detail="Only .xlsx, .csv and .json files are supported.")


@router.post("/bulk", response_model=BulkUploadResult)
async def bulk_upload_characters(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> BulkUploadResult:
    """Import a character sheet: name, class, a, start location, image link."""
    rows = _read_sheet((file.filename or "").lower(), await file.read())

    created = skipped = 0
    errors: list[str] = []
    existing_names = {r[0] for r in db.query(Character.name).all()}
    group = default_group(db)
    try:
        for row in rows:
            name = row.values.get("name", "")
            if not name:
                errors.append(f"Row {row.line}: missing a name.")
                continue
            if name in existing_names:
                skipped += 1
                continue
            race = corruption.normalize_class(row.values.get("class"))
            if race is None:
                errors.append(f"Row {row.line} ({name}): unknown class “{row.values['class']}”.")
                continue
            a: float | None = None
            if row.values.get("a"):
                try:
                    a = float(row.values["a"])
                except ValueError:
                    a = None
                if a is None or not 0 < a <= 100:
                    errors.append(f"Row {row.line} ({name}): a must be a number above 0 and up to 100.")
                    continue
            location = row.values.get("location")
            point = find_location(db, location)
            if location and point is None:
                errors.append(f"Row {row.line} ({name}): unknown location “{location}”, placed in Rivendell.")

            character = Character(
                name=name,
                race=race,
                corruption_a=a,
                avatar_url=normalize_image_url(row.values.get("image")),
            )
            db.add(character)
            db.flush()
            place_character(db, character, *(point or default_start()))
            if group is not None:
                assign(db, character, group.id)
            existing_names.add(name)
            created += 1
        db.commit()
    except IntegrityError:
        # Another request imported/created an overlapping name concurrently.
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Some of these characters were just added by someone else. Try again.",
        )
    return BulkUploadResult(created=created, skipped=skipped, errors=errors)


@router.delete("/{character_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_character(character_id: int, db: Session = Depends(get_db)) -> None:
    character = db.get(Character, character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found.")
    db.delete(character)
    db.commit()
