from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.repositories.analytics import AnalyticsRepository
from app.schemas.analytics import (
    AnnualFilter,
    AnnualResponse,
    CatalogResponse,
    DashboardFilter,
    DashboardResponse,
    PopulationResponse,
    YearFilter,
)
from app.services.analytics import AnalyticsService

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
    responses={
        503: {"description": "Banco ou versão de dados indisponível"},
    },
)


def get_analytics(session: Annotated[Session, Depends(get_session)]) -> AnalyticsService:
    return AnalyticsService(AnalyticsRepository(session))


@router.get("/catalog", response_model=CatalogResponse)
def catalog(service: Annotated[AnalyticsService, Depends(get_analytics)]):
    return service.catalog()


@router.get(
    "/annual",
    response_model=AnnualResponse,
    summary="Estimativa anual e desvinculações por rede/modalidade em MT",
)
def annual(
    filters: Annotated[AnnualFilter, Query()],
    service: Annotated[AnalyticsService, Depends(get_analytics)],
):
    return service.annual(filters)


@router.get(
    "/population",
    response_model=PopulationResponse,
    summary="População estadual 18–24 ligada à oferta presencial do Censo 2022",
)
def population(
    filters: Annotated[YearFilter, Query()],
    service: Annotated[AnalyticsService, Depends(get_analytics)],
):
    return service.population(filters)


@router.get(
    "/dashboard",
    response_model=DashboardResponse,
    summary="Produtos gráficos reais, cruzamentos e cobertura em MT",
)
def dashboard(
    filters: Annotated[DashboardFilter, Query()],
    service: Annotated[AnalyticsService, Depends(get_analytics)],
):
    return service.dashboard(filters)
