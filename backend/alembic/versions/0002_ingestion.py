"""Controle de carga, origem, staging técnico e produtos diagnósticos de MT."""
from pathlib import Path

from alembic import op

revision = "0002_ingestion"
down_revision = "0001_create_schemas"
branch_labels = None
depends_on = None


def upgrade() -> None:
    source = Path(__file__).resolve().parents[3] / "sql" / "0002_ingestion.sql"
    op.execute(source.read_text(encoding="utf-8"))


def downgrade() -> None:
    raise RuntimeError("Reversão destrutiva bloqueada: preserve as cargas e seu histórico.")
