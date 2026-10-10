"""Produtos gráficos calculados com pandas sobre a versão carregada."""

from alembic import op

revision = "0003_dashboard"
down_revision = "0002_ingestion"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE analytics.dashboard_mt (
      release_id UUID PRIMARY KEY REFERENCES control.dataset_release(id),
      contract_version TEXT NOT NULL,
      payload JSONB NOT NULL,
      audit JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """)


def downgrade() -> None:
    raise RuntimeError("Reversão destrutiva bloqueada: preserve os produtos e seu histórico.")
