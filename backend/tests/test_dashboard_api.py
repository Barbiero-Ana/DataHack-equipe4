from datetime import UTC, datetime
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.schemas.analytics import DashboardFilter
from app.services.analytics import AnalyticsService


def repository():
    repo = MagicMock()
    repo.active_dataset.return_value = {
        "release_id": uuid4(),
        "contract_version": "1.0.1",
        "created_at": datetime.now(UTC),
        "validation": {},
    }
    repo.dashboard.return_value = {
        "contract_version": "dashboard-1.0.0",
        "audit": {},
        "payload": {
            "courses": [
                {
                    "network": "1",
                    "modality": "1",
                    "degree": "2",
                    "area": "Educação",
                    "municipality": "5103403",
                },
                {
                    "network": "2",
                    "modality": "1",
                    "degree": "1",
                    "area": "Saúde",
                    "municipality": "5108402",
                },
            ],
            "municipal": [{"network": "1", "municipality": "5103403", "name": "Cuiabá"}],
            "finance": [
                {
                    "network": "2",
                    "modality": "1",
                    "degree": "1",
                    "area": "Saúde",
                    "municipality": "5108402",
                    "year": 2024,
                    "matriculated": 100,
                    "fies": 20,
                    "prouni_full": 30,
                    "prouni_partial": 10,
                }
            ],
        },
    }
    return repo


def test_filter_never_reuses_private_rows_for_public_network():
    result = AnalyticsService(repository()).dashboard(DashboardFilter(network="1"))
    assert len(result.data["courses"]) == 1
    assert result.data["courses"][0]["network"] == "1"
    assert result.data["finance"] == []


def test_municipal_scope_and_financing_are_explicit():
    result = AnalyticsService(repository()).dashboard(DashboardFilter(degree="1"))
    assert len(result.data["courses"]) == 1
    assert result.data["municipal"][0]["name"] == "Cuiabá"
    assert result.data["finance"][0]["fies"] == 20
    assert result.data["finance"][0]["prouni_full"] == 30
    # Nenhum campo falso de união de beneficiários.
    assert "unique_funded" not in result.data["finance"][0]


def test_missing_product_has_safe_503():
    repo = repository()
    repo.dashboard.return_value = None
    with pytest.raises(HTTPException) as exc:
        AnalyticsService(repo).dashboard(DashboardFilter())
    assert exc.value.status_code == 503


def test_population_is_not_filtered_by_education_network_or_degree():
    repo = repository()
    repo.dashboard.return_value["payload"]["municipal_population"] = [
        {"municipality": "5103403", "name": "Cuiabá", "population": 100},
        {"municipality": "5108402", "name": "Várzea Grande", "population": 50},
    ]
    service = AnalyticsService(repo)
    assert (
        len(
            service.dashboard(DashboardFilter(network="1", degree="2")).data["municipal_population"]
        )
        == 2
    )
    assert (
        len(service.dashboard(DashboardFilter(municipality="5103403")).data["municipal_population"])
        == 1
    )
