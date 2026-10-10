from alembic import context
from app.core.config import Settings
from app.core.database import create_database_engine
from app.db.base import Base


def run_migrations() -> None:
    # SQL offline não necessita de credenciais nem acesso ao banco.
    if context.is_offline_mode():
        context.configure(
            dialect_name="postgresql", target_metadata=Base.metadata, literal_binds=True
        )
        with context.begin_transaction():
            context.run_migrations()
        return

    settings = Settings()
    engine = create_database_engine(settings, pooled=False)
    try:
        with engine.connect() as connection:
            context.configure(connection=connection, target_metadata=Base.metadata)
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()


run_migrations()
