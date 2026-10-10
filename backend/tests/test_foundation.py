import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.main import create_app


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(Settings(_env_file=None, environment="test")))


def test_liveness(client: TestClient) -> None:
    with client:
        response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "alive"}


def test_readiness_is_explicitly_unavailable(client: TestClient) -> None:
    response = client.get("/health/ready")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "persistence_not_configured"


def test_openapi_and_docs(client: TestClient) -> None:
    assert client.get("/docs").status_code == 200
    schema = client.get("/openapi.json").json()
    assert schema["info"]["title"] == "Rota do Diploma"
    assert "/health/live" in schema["paths"]
    assert "/health/ready" in schema["paths"]


def test_environment_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_NAME", "API de teste")
    monkeypatch.setenv("CORS_ORIGINS", '["http://localhost:3000"]')
    config = Settings(_env_file=None)
    assert config.app_name == "API de teste"
    assert str(config.cors_origins[0]) == "http://localhost:3000/"


def test_dotenv(tmp_path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text("ENVIRONMENT=test\n", encoding="utf-8")
    assert Settings(_env_file=env_file).environment == "test"


@pytest.mark.parametrize(
    "values",
    [
        {"environment": "invalid"},
        {"app_name": ""},
        {"api_v1_prefix": "api/v1"},
        {"api_v1_prefix": "/api/v1/"},
        {"cors_origins": ["*"]},
        {"cors_origins": ["https://user:secret@example.org"]},
        {"cors_origins": ["https://example.org/path"]},
    ],
)
def test_invalid_configuration(values: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **values)


def test_cors() -> None:
    config = Settings(_env_file=None, cors_origins=["http://localhost:3000"])
    with TestClient(create_app(config)) as client:
        allowed = client.options(
            "/health/live",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        denied = client.options(
            "/health/live",
            headers={
                "Origin": "https://unconfigured.example",
                "Access-Control-Request-Method": "GET",
            },
        )
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert denied.status_code == 400
    assert "access-control-allow-origin" not in denied.headers
