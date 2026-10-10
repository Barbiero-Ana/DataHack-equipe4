"""SQL parametrizado e restrito à versão selecionada em cada requisição."""

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.analytics import AnnualFilter


class AnalyticsRepository:
    def __init__(self, session: Session):
        self.session = session

    def active_dataset(self):
        return (
            self.session.execute(
                text(
                    "SELECT d.id release_id,d.contract_version,d.created_at,d.validation "
                    "FROM control.active_release a "
                    "JOIN control.dataset_release d ON d.id=a.release_id "
                    "WHERE a.product='diagnostico_mt'"
                )
            )
            .mappings()
            .first()
        )

    def years(self, release: UUID, *, population: bool = False):
        table = "population_census_mt" if population else "annual_mt"
        return (
            self.session.execute(
                text(
                    f"SELECT DISTINCT year FROM analytics.{table} "
                    "WHERE release_id=:release ORDER BY year"
                ),
                {"release": release},
            )
            .scalars()
            .all()
        )

    def annual(self, release: UUID, filters: AnnualFilter):
        parameters = {"release": release, **filters.model_dump(exclude_none=True)}
        clauses = "".join(
            f" AND {key}=:{key}" for key in filters.model_fields_set if key in parameters
        )
        return (
            self.session.execute(
                text(
                    "SELECT * FROM analytics.annual_mt WHERE release_id=:release"
                    + clauses
                    + " ORDER BY year,network,modality"
                ),
                parameters,
            )
            .mappings()
            .all()
        )

    def population(self, release: UUID, year: int | None):
        clause = " AND year=:year" if year is not None else ""
        return (
            self.session.execute(
                text(
                    "SELECT * FROM analytics.population_census_mt WHERE release_id=:release"
                    + clause
                    + " ORDER BY year"
                ),
                {"release": release, "year": year},
            )
            .mappings()
            .all()
        )

    def dashboard(self, release: UUID):
        return (
            self.session.execute(
                text(
                    "SELECT contract_version,payload,audit FROM analytics.dashboard_mt "
                    "WHERE release_id=:release"
                ),
                {"release": release},
            )
            .mappings()
            .first()
        )
