import os

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError

from alembic import command
from app.core.config import BACKEND_ROOT, Settings
from app.core.database import create_database_engine
from app.main import create_app

pytestmark = pytest.mark.postgres


@pytest.fixture
def postgres_settings() -> Settings:
    value = os.getenv("TEST_DATABASE_URL")
    if not value:
        pytest.skip("Defina TEST_DATABASE_URL para um PostgreSQL local descartável.")
    url = make_url(value)
    if url.host not in ("127.0.0.1", "localhost") or not url.database.startswith("test_"):
        pytest.fail("Integração permitida somente em localhost e banco com prefixo test_.")
    return Settings(_env_file=None, environment="test", database_url=value)


def test_postgres_readiness_and_timeout(postgres_settings: Settings) -> None:
    with TestClient(create_app(postgres_settings)) as client:
        response = client.get("/health/ready")
        assert response.status_code == 200
        assert response.json() == {"status": "ready"}
    engine = create_database_engine(
        postgres_settings.model_copy(update={"db_statement_timeout_ms": 100})
    )
    try:
        with engine.connect() as connection:
            with pytest.raises(OperationalError):
                connection.execute(text("SELECT pg_sleep(1)"))
    finally:
        engine.dispose()


def test_postgres_migration_preserves_existing_data(
    postgres_settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("DATABASE_URL", postgres_settings.database_url.get_secret_value())
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    engine = create_database_engine(postgres_settings)
    try:
        # Somente no banco descartável explicitamente selecionado.
        with engine.begin() as connection:
            connection.execute(text("CREATE SCHEMA IF NOT EXISTS raw"))
            connection.execute(text("CREATE TABLE IF NOT EXISTS raw.test_sentinel (id INTEGER)"))
            connection.execute(text("INSERT INTO raw.test_sentinel VALUES (42)"))
            count = connection.execute(text("SELECT COUNT(*) FROM raw.test_sentinel")).scalar_one()
        command.upgrade(config, "head")
        command.upgrade(config, "head")
        with engine.connect() as connection:
            schemas = set(
                connection.execute(
                    text("SELECT schema_name FROM information_schema.schemata")
                ).scalars()
            )
            assert {"control", "raw", "staging", "analytics"} <= schemas
            assert (
                connection.execute(text("SELECT COUNT(*) FROM raw.test_sentinel")).scalar_one()
                == count
            )
            assert (
                connection.execute(
                    text("SELECT version_num FROM public.alembic_version")
                ).scalar_one()
                == "0003_dashboard"
            )
    finally:
        engine.dispose()
