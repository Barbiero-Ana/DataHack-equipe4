"""Cria somente os schemas de organização, preservando estruturas existentes."""

from alembic import op

revision = "0001_create_schemas"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    for schema in ("control", "raw", "staging", "analytics"):
        op.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')


def downgrade() -> None:
    raise RuntimeError("Downgrade bloqueado: schemas podem conter dados ou existir previamente.")
