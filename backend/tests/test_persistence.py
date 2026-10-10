from io import StringIO
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker
from starlette.requests import Request

from alembic import command
from app.core.config import BACKEND_ROOT, Settings
from app.core.database import create_database_engine, get_session
from app.main import create_app

# Somente dados artificiais para validar configuração; nunca usados para conexão real.
TEST_URL = "postgresql+psycopg://test:fake-password@localhost/disposable"


def test_engine_configuration() -> None:
    config = Settings(_env_file=None, database_url=TEST_URL)
    engine = create_database_engine(config)
    try:
        assert engine.dialect.driver == "psycopg"
        assert engine.pool.size() == 3
        assert engine.pool.timeout() == 5
        assert engine.hide_parameters is True
        args, kwargs = engine.dialect.create_connect_args(engine.url)
        assert kwargs["dbname"] == "disposable"
        assert args == []
        with patch("app.core.database.create_engine") as create:
            create_database_engine(config)
        options = create.call_args.kwargs
        assert options["pool_pre_ping"] is True
        assert options["connect_args"]["connect_timeout"] == 5
        assert options["connect_args"]["options"] == "-c statement_timeout=3000"
    finally:
        engine.dispose()


def test_url_normalization_and_secret_repr() -> None:
    config = Settings(_env_file=None, database_url=TEST_URL.replace("+psycopg", ""))
    engine = create_database_engine(config)
    try:
        assert engine.url.drivername == "postgresql+psycopg"
        assert "fake-password" not in repr(config)
    finally:
        engine.dispose()


@pytest.mark.parametrize("value", ["invalid", "sqlite:///test", "postgresql://localhost/"])
def test_invalid_database_url(value: str) -> None:
    with pytest.raises(ValidationError) as error:
        Settings(_env_file=None, database_url=value)
    assert value not in str(error.value)


def test_production_requires_database() -> None:
    with pytest.raises(ValidationError, match="DATABASE_URL é obrigatória"):
        Settings(_env_file=None, environment="production")


def test_database_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", TEST_URL)
    monkeypatch.setenv("DB_POOL_SIZE", "4")
    config = Settings(_env_file=None)
    assert config.database_url.get_secret_value() == TEST_URL
    assert config.db_pool_size == 4


def test_lifespan_disposes_resources() -> None:
    with patch("app.main.Database") as database:
        app = create_app(Settings(_env_file=None, database_url=TEST_URL))
        with TestClient(app) as client:
            assert app.state.database is database.return_value
            assert client.get("/health/live").status_code == 200
        database.return_value.dispose.assert_called_once()
        assert app.state.database is None


@pytest.mark.parametrize("available", [True, False])
def test_readiness(available: bool, caplog: pytest.LogCaptureFixture) -> None:
    session = MagicMock(spec=Session)
    if available:
        session.execute.return_value.scalar_one.return_value = 1
    else:
        session.execute.side_effect = OperationalError("SELECT 1", {}, Exception(TEST_URL))
    app = create_app(Settings(_env_file=None, database_url=TEST_URL))
    with patch("app.main.Database") as database:
        database.return_value.session_factory.return_value.__enter__.return_value = session
        with TestClient(app) as client:
            response = client.get("/health/ready")
            assert client.get("/health/live").status_code == 200
    assert response.status_code == (200 if available else 503)
    if available:
        assert response.json() == {"status": "ready"}
        assert str(session.execute.call_args.args[0]) == "SELECT 1"
    else:
        assert response.json()["detail"]["code"] == "database_unavailable"
        assert "fake-password" not in response.text + caplog.text
    session.commit.assert_not_called()


def test_failed_checkout_is_sanitized() -> None:
    app = create_app(Settings(_env_file=None, database_url=TEST_URL))
    with patch("app.main.Database") as database:
        database.return_value.session_factory.return_value.__enter__.side_effect = OperationalError(
            "connect", {}, Exception(TEST_URL)
        )
        with TestClient(app) as client:
            response = client.get("/health/ready")
    assert response.status_code == 503
    assert "fake-password" not in response.text


def test_sessions_rollback_pending_changes_and_allow_explicit_commit() -> None:
    # SQLite apenas para testar transações da sessão, não migrations PostgreSQL.
    engine = create_engine("sqlite://")
    factory = sessionmaker(bind=engine)
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE example (id INTEGER)"))
    app = create_app(Settings(_env_file=None))
    app.state.database = SimpleNamespace(session_factory=factory)
    request = Request({"type": "http", "app": app})
    try:
        dependency = get_session(request)
        session = next(dependency)
        session.execute(text("INSERT INTO example VALUES (1)"))
        dependency.close()
        with engine.connect() as connection:
            assert connection.execute(text("SELECT COUNT(*) FROM example")).scalar_one() == 0
        dependency = get_session(request)
        session = next(dependency)
        session.execute(text("INSERT INTO example VALUES (2)"))
        session.commit()
        dependency.close()
        with engine.connect() as connection:
            assert connection.execute(text("SELECT COUNT(*) FROM example")).scalar_one() == 1
    finally:
        engine.dispose()


def test_session_rollback_on_application_error() -> None:
    session = MagicMock(spec=Session)
    database = MagicMock()
    database.session_factory.return_value.__enter__.return_value = session
    app = create_app(Settings(_env_file=None))
    app.state.database = database
    dependency = get_session(Request({"type": "http", "app": app}))
    next(dependency)
    with pytest.raises(ValueError, match="application failed"):
        dependency.throw(ValueError("application failed"))
    assert database.session_factory.return_value.__exit__.call_args.args[0] is ValueError


def test_alembic_offline() -> None:
    output = StringIO()
    config = Config(str(BACKEND_ROOT / "alembic.ini"), output_buffer=output)
    command.upgrade(config, "head", sql=True)
    sql = output.getvalue()
    for schema in ("control", "raw", "staging", "analytics"):
        assert f'CREATE SCHEMA IF NOT EXISTS "{schema}"' in sql
    assert "DROP" not in sql
    assert "CREATE TABLE alembic_version" in sql
