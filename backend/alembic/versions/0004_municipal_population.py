"""Fonte complementar IBGE municipal com rastreabilidade nas quatro camadas."""

from alembic import op

revision = "0004_municipal_population"
down_revision = "0003_dashboard"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TABLE control.municipal_population_import (
      id UUID PRIMARY KEY,
      release_id UUID NOT NULL REFERENCES control.dataset_release(id),
      source_name TEXT NOT NULL, sha256 TEXT NOT NULL, reference_sha256 TEXT NOT NULL,
      year INTEGER NOT NULL CHECK (year=2022), audit JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(release_id,sha256)
    );
    CREATE TABLE raw.municipal_population (
      import_id UUID NOT NULL REFERENCES control.municipal_population_import(id),
      source_row INTEGER NOT NULL, payload JSONB NOT NULL,
      PRIMARY KEY(import_id,source_row)
    );
    CREATE TABLE staging.municipal_population (
      import_id UUID NOT NULL REFERENCES control.municipal_population_import(id),
      municipality TEXT NOT NULL CHECK (municipality ~ '^51[0-9]{5}$'),
      name TEXT NOT NULL, year INTEGER NOT NULL CHECK(year=2022),
      population_18 INTEGER NOT NULL CHECK(population_18>=0),
      population_19 INTEGER NOT NULL CHECK(population_19>=0),
      population_20_24 INTEGER NOT NULL CHECK(population_20_24>=0),
      population INTEGER NOT NULL CHECK(population=population_18+population_19+population_20_24),
      PRIMARY KEY(import_id,municipality)
    );
    """)


def downgrade():
    raise RuntimeError("Reversão destrutiva bloqueada: preserve a fonte e o histórico.")
