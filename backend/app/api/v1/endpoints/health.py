from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.db.health import check_database

router = APIRouter(prefix="/health", tags=["Health"])


class LivenessResponse(BaseModel):
    status: Literal["alive"] = "alive"


@router.get("/live", response_model=LivenessResponse)
def liveness() -> LivenessResponse:
    return LivenessResponse()


class ReadinessResponse(BaseModel):
    status: Literal["ready"] = "ready"


@router.get("/ready", responses={503: {"description": "Banco indisponível ou não configurado"}})
def readiness(session: Annotated[Session, Depends(get_session)]) -> ReadinessResponse:
    check_database(session)
    return ReadinessResponse()
