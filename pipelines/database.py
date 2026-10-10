"""Conexão dedicada à ingestão/CLI; não utiliza o pool HTTP."""

import json
from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from sqlalchemy.engine import make_url

from backend.app.core.config import Settings

ROOT = Path(__file__).resolve().parents[1]


def connect(url: str | None = None, *, readonly: bool = False):
    if url is None:
        configured = Settings().database_url
        if configured is None:
            raise ValueError("DATABASE_URL não configurada.")
        url = configured.get_secret_value()
    parsed = make_url(url)
    if parsed.get_backend_name() != "postgresql":
        raise ValueError("Somente PostgreSQL é suportado.")
    connection = psycopg.connect(
        host=parsed.host, port=parsed.port or 5432, dbname=parsed.database,
        user=parsed.username, password=parsed.password,
        **dict(parsed.query), connect_timeout=5,
        options="-c statement_timeout=120000 -c lock_timeout=10000",
        row_factory=dict_row,
    )
    connection.read_only = readonly
    return connection


def records(frame):
    # Serialização do pandas transforma pd.NA/NaN em NULL e tipos numpy em tipos nativos.
    return json.loads(frame.to_json(orient="records", force_ascii=False, double_precision=15))


def active(connection):
    row = connection.execute(
        "SELECT release_id FROM control.active_release WHERE product='diagnostico_mt'"
    ).fetchone()
    if row is None:
        raise ValueError("Nenhuma versão validada ativa. Execute a carga primeiro.")
    return row["release_id"]


def filters(year=None, network=None, modality=None, municipality=None, course=None):
    values = {"year": year, "network": network, "modality": modality,
              "municipality": municipality, "course": course}
    if year is not None and not 1900 <= year <= 2100:
        raise ValueError("Ano inválido.")
    for key in ("network", "modality"):
        if values[key] is not None and values[key] not in ("1", "2"):
            raise ValueError(f"{key} aceita apenas 1 ou 2.")
    for key in ("municipality", "course"):
        if values[key] is not None and not values[key].isdigit():
            raise ValueError(f"{key} deve conter um código numérico.")
    # Identificadores vêm exclusivamente da lista interna; valores são parametrizados.
    selected = {key: value for key, value in values.items() if value is not None}
    clauses = "".join(f" AND {key}=%({key})s" for key in selected)
    return clauses, selected
