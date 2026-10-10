"""Contratos públicos dos produtos diagnósticos de MT."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

Network = Literal["1", "2"]
Modality = Literal["1", "2"]
EstimateStatus = Literal[
    "calculada",
    "sem_base_ano_anterior",
    "sem_base_ano_atual",
    "denominador_nao_positivo",
    "revisar_estimativa_fora_0_100",
]


class YearFilter(BaseModel):
    model_config = ConfigDict(extra="forbid")
    year: int | None = Field(default=None, ge=1900, le=2100)


class AnnualFilter(YearFilter):
    network: Network | None = None
    modality: Modality | None = None


class DatasetMetadata(BaseModel):
    release_id: UUID
    contract_version: str
    created_at: datetime
    publication: Literal["diagnostico"] = "diagnostico"
    geographic_level: Literal["UF"] = "UF"
    uf: Literal["51"] = "51"
    pending: list[str]


class CatalogResponse(BaseModel):
    metadata: DatasetMetadata
    annual_years: list[int]
    population_years: list[int]
    networks: dict[str, str] = {"1": "Pública", "2": "Privada"}
    modalities: dict[str, str] = {"1": "Presencial", "2": "EAD"}


class AnnualRecord(BaseModel):
    year: int
    uf: Literal["51"]
    network: Network
    modality: Modality
    qt_mat: int | None
    qt_ing: int | None
    qt_conc: int | None
    qt_desvinculado: int | None
    qt_registros_oferta: int | None
    qt_mat_anterior: int | None
    qt_conc_anterior: int | None
    numerador_permanencia: int | None
    denominador_permanencia: int | None
    evasao_estimada_pct: float | None
    status_estimativa: EstimateStatus


class AnnualResponse(BaseModel):
    metadata: DatasetMetadata
    filters: AnnualFilter
    total: int
    records: list[AnnualRecord]


class PopulationRecord(BaseModel):
    year: int
    uf: Literal["51"]
    qt_cursos_presenciais: int
    qt_mat_presencial: int
    qt_vg_presencial: int
    qt_pop_18_19: int
    qt_pop_20_24: int
    qt_pop_18_24: int


class PopulationResponse(BaseModel):
    metadata: DatasetMetadata
    filters: YearFilter
    total: int
    records: list[PopulationRecord]


class DashboardFilter(BaseModel):
    model_config = ConfigDict(extra="forbid")
    network: Network | None = None
    modality: Modality | None = None
    degree: Literal["1", "2", "3"] | None = None
    area: str | None = Field(default=None, max_length=160)
    municipality: str | None = Field(default=None, pattern=r"^51[0-9]{5}$")


class DashboardResponse(BaseModel):
    metadata: DatasetMetadata
    chart_contract: str
    filters: DashboardFilter
    data: dict[str, list[dict]]
    options: dict[str, list[dict]]
    audit: dict
