from collections.abc import Iterator
from logging import getLogger

from fastapi import HTTPException, Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings

logger = getLogger(__name__)


def create_database_engine(settings: Settings, *, pooled: bool = True) -> Engine:
    if settings.database_url is None:
        raise ValueError("DATABASE_URL não configurada.")
    url = make_url(settings.database_url.get_secret_value()).set(drivername="postgresql+psycopg")
    from sqlalchemy.pool import NullPool

    pool_options = (
        {
            "pool_size": settings.db_pool_size,
            "max_overflow": settings.db_max_overflow,
            "pool_timeout": settings.db_pool_timeout,
            "pool_recycle": settings.db_pool_recycle,
        }
        if pooled
        else {"poolclass": NullPool}
    )
    return create_engine(
        url,
        pool_pre_ping=True,
        **pool_options,
        hide_parameters=True,
        connect_args={
            "connect_timeout": settings.db_connect_timeout,
            "options": f"-c statement_timeout={settings.db_statement_timeout_ms}",
        },
    )


class Database:
    def __init__(self, settings: Settings) -> None:
        self.engine = create_database_engine(settings)
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)

    def dispose(self) -> None:
        self.engine.dispose()


def get_session(request: Request) -> Iterator[Session]:
    database: Database | None = request.app.state.database
    if database is None:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "persistence_not_configured",
                "message": "Persistência não configurada.",
            },
        )
    # Fechar a sessão desfaz transações pendentes. Nunca há commit implícito.
    try:
        with database.session_factory() as session:
            yield session
    except SQLAlchemyError:
        logger.warning("database_operation_failed")
        raise HTTPException(
            status_code=503,
            detail={"code": "database_unavailable", "message": "Banco de dados indisponível."},
        ) from None
