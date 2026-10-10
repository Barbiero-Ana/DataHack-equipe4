from datetime import UTC, datetime
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.database import get_session
from app.main import create_app
from app.repositories.analytics import AnalyticsRepository
from app.schemas.analytics import AnnualFilter

RELEASE = uuid4()
DATASET = {
    "release_id": RELEASE,
    "contract_version": "1.0.1",
    "created_at": datetime(2026, 10, 10, tzinfo=UTC),
    "validation": {"pending": ["Censo 2020"]},
}
ROW = {
    "year": 2021,
    "uf": "51",
    "network": "1",
    "modality": "1",
    "qt_mat": 100,
    "qt_ing": 20,
    "qt_conc": 5,
    "qt_desvinculado": 7,
    "qt_registros_oferta": 1,
    "qt_mat_anterior": None,
    "qt_conc_anterior": None,
    "numerador_permanencia": 80,
    "denominador_permanencia": None,
    "evasao_estimada_pct": None,
    "status_estimativa": "sem_base_ano_anterior",
}


@pytest.fixture
def client():
    session = MagicMock(spec=Session)
    session.execute.return_value.mappings.return_value.first.return_value = DATASET
    session.execute.return_value.mappings.return_value.all.return_value = [ROW]
    app = create_app(Settings(_env_file=None))
    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as http:
        yield http, session


def test_annual_contract_preserves_null_and_release(client):
    http, session = client
    response = http.get("/api/v1/analytics/annual?year=2021&network=1&modality=1")
    assert response.status_code == 200
    body = response.json()
    assert body["metadata"]["release_id"] == str(RELEASE)
    assert body["metadata"]["publication"] == "diagnostico"
    assert body["records"][0]["evasao_estimada_pct"] is None
    assert body["records"][0]["qt_desvinculado"] == 7
    assert body["filters"] == {"year": 2021, "network": "1", "modality": "1"}
    assert session.execute.call_args.args[1]["release"] == RELEASE
    session.commit.assert_not_called()


@pytest.mark.parametrize(
    "path",
    [
        "annual?network=3",
        "annual?year=1800",
        "annual?course=123",
        "annual?municipality=5103403",
        "annual?year=abc",
        "population?network=1",
        "population?modality=2",
        "population?municipality=5103403",
    ],
)
def test_filters_are_strict(client, path):
    http, session = client
    assert http.get("/api/v1/analytics/" + path).status_code == 422
    session.execute.assert_not_called()


def test_no_active_release(client):
    http, session = client
    session.execute.return_value.mappings.return_value.first.return_value = None
    response = http.get("/api/v1/analytics/annual")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "dataset_unavailable"


def test_empty_filter_is_not_zero(client):
    http, session = client
    session.execute.return_value.mappings.return_value.all.return_value = []
    body = http.get("/api/v1/analytics/annual?year=2020").json()
    assert body["records"] == []
    assert body["total"] == 0


def test_repository_parameters_do_not_interpolate():
    session = MagicMock(spec=Session)
    AnalyticsRepository(session).annual(RELEASE, AnnualFilter(year=2024, network="2"))
    statement, parameters = session.execute.call_args.args
    assert "2024" not in str(statement)
    assert ":year" in str(statement)
    assert parameters["year"] == 2024


def test_unconfigured_persistence():
    with TestClient(create_app(Settings(_env_file=None))) as client:
        response = client.get("/api/v1/analytics/catalog")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "persistence_not_configured"


def test_sql_failure_is_sanitized(monkeypatch):
    class BrokenRepository:
        def active_dataset(self):
            raise OperationalError("SELECT secret", {}, Exception("sensitive-password"))

    monkeypatch.setattr(
        "app.api.v1.endpoints.analytics.AnalyticsRepository", lambda session: BrokenRepository()
    )
    app = create_app(
        Settings(_env_file=None, database_url="postgresql://test:test@localhost/test_x")
    )
    database = MagicMock()
    with patch("app.main.Database", return_value=database), TestClient(app) as client:
        response = client.get("/api/v1/analytics/annual")
    assert response.status_code == 503
    assert "sensitive-password" not in response.text
    assert response.json()["detail"]["code"] == "database_unavailable"
