from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.crisis_note import Staff
from app.schemas import StaffCreate, StaffResponse

router = APIRouter(prefix="/staff", tags=["staff"])


@router.get("", response_model=list[StaffResponse])
def list_staff(db: Session = Depends(get_db)) -> list[Staff]:
    return db.query(Staff).order_by(Staff.name).all()


@router.post("", response_model=StaffResponse, status_code=status.HTTP_201_CREATED)
def create_staff(body: StaffCreate, db: Session = Depends(get_db)) -> Staff:
    member = Staff(name=body.name.strip())
    db.add(member)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A staff member with that name already exists.")
    db.refresh(member)
    return member


@router.delete("/{staff_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_staff(staff_id: int, db: Session = Depends(get_db)) -> None:
    member = db.get(Staff, staff_id)
    if not member:
        raise HTTPException(status_code=404, detail="Staff member not found.")
    db.delete(member)
    db.commit()
