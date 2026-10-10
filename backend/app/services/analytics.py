"""Disponibilidade, procedência e montagem dos contratos analíticos."""

from fastapi import HTTPException

from app.repositories.analytics import AnalyticsRepository
from app.schemas.analytics import (
    AnnualFilter,
    AnnualResponse,
    CatalogResponse,
    DatasetMetadata,
    PopulationResponse,
    YearFilter,
)


class AnalyticsService:
    def __init__(self, repository: AnalyticsRepository):
        self.repository = repository

    def metadata(self) -> DatasetMetadata:
        dataset = self.repository.active_dataset()
        if dataset is None:
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "dataset_unavailable",
                    "message": "Nenhuma versão validada disponível.",
                },
            )
        return DatasetMetadata(
            release_id=dataset["release_id"],
            contract_version=dataset["contract_version"],
            created_at=dataset["created_at"],
            pending=dataset["validation"].get("pending", []),
        )

    def catalog(self) -> CatalogResponse:
        metadata = self.metadata()
        return CatalogResponse(
            metadata=metadata,
            annual_years=self.repository.years(metadata.release_id),
            population_years=self.repository.years(metadata.release_id, population=True),
        )

    def annual(self, filters: AnnualFilter) -> AnnualResponse:
        metadata = self.metadata()
        rows = self.repository.annual(metadata.release_id, filters)
        return AnnualResponse(metadata=metadata, filters=filters, total=len(rows), records=rows)

    def population(self, filters: YearFilter) -> PopulationResponse:
        metadata = self.metadata()
        rows = self.repository.population(metadata.release_id, filters.year)
        return PopulationResponse(metadata=metadata, filters=filters, total=len(rows), records=rows)

    def dashboard(self, filters):
        from app.schemas.analytics import DashboardResponse

        metadata = self.metadata()
        product = self.repository.dashboard(metadata.release_id)
        if product is None:
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "chart_product_unavailable",
                    "message": "Produto gráfico ainda não publicado para esta versão.",
                },
            )
        payload = product["payload"]
        selected = filters.model_dump(exclude_none=True)
        data = {}
        for name, rows in payload.items():
            applicable = {
                key: value
                for key, value in selected.items()
                if name != "municipal" or key in ("network", "municipality")
            }
            data[name] = [
                row
                for row in rows
                if all(row.get(key) == value for key, value in applicable.items())
            ]
        totals = {}
        for row in data["finance"]:
            key = (row["year"], row["modality"])
            target = totals.setdefault(key, {"year": key[0], "modality": key[1],
                "matriculated": 0, "fies": 0, "prouni_full": 0, "prouni_partial": 0})
            for measure in ("matriculated", "fies", "prouni_full", "prouni_partial"):
                target[measure] += row[measure]
        data["finance"] = [row for row in totals.values() if row["matriculated"] >= 10]
        municipality_names = {row["municipality"]: row["name"] for row in payload["municipal"]}
        codes = {row["municipality"] for row in payload["courses"]} | set(municipality_names)
        options = {
            "areas": [
                {"value": area, "label": area}
                for area in sorted({row["area"] for row in payload["courses"] if row["area"]})
            ],
            "municipalities": [
                {"value": code, "label": municipality_names.get(code, code)}
                for code in sorted(codes)
            ],
        }
        return DashboardResponse(
            metadata=metadata,
            chart_contract=product["contract_version"],
            filters=filters,
            data=data,
            options=options,
            audit=product["audit"],
        )
