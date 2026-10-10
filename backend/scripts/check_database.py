"""Inspeção somente leitura: python -m scripts.check_database."""

import json

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import Settings
from app.core.database import create_database_engine


def main() -> int:
    engine = create_database_engine(Settings())
    try:
        with engine.connect() as connection:
            with connection.begin():
                connection.execute(text("SET TRANSACTION READ ONLY"))
                version = connection.execute(text("SHOW server_version")).scalar_one()
                schemas = (
                    connection.execute(
                        text(
                            "SELECT schema_name FROM information_schema.schemata "
                            "ORDER BY schema_name"
                        )
                    )
                    .scalars()
                    .all()
                )
                tables = connection.execute(
                    text(
                        "SELECT table_schema, table_name FROM information_schema.tables "
                        "WHERE table_schema NOT IN ('pg_catalog', 'information_schema') "
                        "ORDER BY table_schema, table_name"
                    )
                ).all()
                revision = None
                if ("public", "alembic_version") in tables:
                    revision = (
                        connection.execute(text("SELECT version_num FROM public.alembic_version"))
                        .scalars()
                        .all()
                    )
                print(
                    json.dumps(
                        {
                            "server_version": version,
                            "schemas": schemas,
                            "tables": [list(row) for row in tables],
                            "alembic_revision": revision,
                        },
                        indent=2,
                    )
                )
        return 0
    except SQLAlchemyError:
        print("Banco indisponível. Verifique o túnel e a configuração local.")
        return 1
    finally:
        engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
