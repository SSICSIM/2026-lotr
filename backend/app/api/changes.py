from __future__ import annotations

from fastapi import APIRouter

from app.services import changes

router = APIRouter(prefix="/changes", tags=["changes"])


@router.get("")
def get_changes() -> dict[str, str]:
    return {"version": changes.current()}
