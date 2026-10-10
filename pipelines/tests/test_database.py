"""Contratos de carga e consulta, com PostgreSQL descartável opt-in."""

import json
import os

import pandas as pd
import pytest
from sqlalchemy.engine import make_url

from pipelines.database import connect, filters
from pipelines.extract import sha256
from pipelines.load import load
from pipelines.query import query, status
from pipelines.run import RULES_VERSION
from pipelines.transform import clean


def test_filter_parameters_do_not_interpolate_values():
    clause, parameters = filters(2024, "2", "1", "5103403", "123")
    assert "2024" not in clause
    assert parameters["year"] == 2024
    assert "%(municipality)s" in clause
    with pytest.raises(ValueError):
        filters(network="1 OR TRUE")
    with pytest.raises(ValueError):
        filters(course="123;DELETE")


@pytest.fixture
def disposable_url():
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Defina TEST_DATABASE_URL para PostgreSQL local descartável com migrations.")
    parsed = make_url(url)
    if parsed.host not in ("localhost", "127.0.0.1") or not parsed.database.startswith("test_"):
        pytest.fail("Somente banco local test_* é permitido.")
    return url


def write_source(folder, output, family, data, metadata=None):
    source = folder / f"{family}.csv"
    pd.DataFrame(data).to_csv(source, sep=";", encoding="cp1252", index=False)
    original = pd.read_csv(source, sep=";", encoding="cp1252", dtype="string",
                           keep_default_na=False)
    frame = clean(original)[0]
    frame["_SOURCE_ROW"] = range(2, len(frame)+2)
    frame["_SOURCE_FILE"] = source.name
    frame["_REQUIRES_REVIEW"] = False
    stage = output / f"{family}.parquet"
    frame.to_parquet(stage, index=False)
    return {"file": source.name, "family": family, "status": "processed",
            "sha256": sha256(source), "staging": stage.name, "retained_rows": len(frame),
            "rows": len(frame), "source_metadata": metadata or {}}


@pytest.fixture
def sources(tmp_path):
    folder, output = tmp_path / "sources", tmp_path / "output"
    folder.mkdir()
    output.mkdir()
    census = [
        {"NU_ANO_CENSO": year, "CO_UF": "51", "CO_IES": "9", "CO_CURSO": f"{n}{m}",
         "CO_MUNICIPIO": "5103403", "TP_REDE": n, "TP_MODALIDADE_ENSINO": m,
         "TP_DIMENSAO": m, "QT_MAT": 100+year-2021, "QT_ING": 10,
         "QT_CONC": 5, "QT_SIT_DESVINCULADO": 7, "QT_VG_TOTAL": 50}
        for year in range(2021, 2025) for n in ("1", "2") for m in ("1", "2")
    ]
    files = [write_source(folder, output, "censo_cursos", census)]
    files.append(write_source(folder, output, "populacao", [
        {"PAIS_REGIOES_ESTADOS": "Mato Grosso", "18-19 anos": 300, "20-24 anos": 700},
    ], {"reference_year": 2022}))
    for kind in ("censo_ies", "trajetoria", "cpc", "enade"):
        files.append(write_source(folder, output, kind, [
            {"CO_UF": "51", "CO_IES": "9", "CO_CURSO": "11", "NU_ANO_REFERENCIA": 2024},
        ]))
    (output / "manifest.json").write_text(json.dumps({"rules_version": RULES_VERSION,
                                                     "files": files}))
    return folder, output


@pytest.mark.postgres
def test_load_repeat_filters_and_failed_publication(disposable_url, sources, monkeypatch):
    folder, output = sources
    first = load(folder, output, disposable_url)
    repeat = load(folder, output, disposable_url)
    assert repeat["status"] == "already_loaded"
    assert first["release_id"] == repeat["release_id"]
    with connect(disposable_url, readonly=True) as connection:
        before = status(connection)
        selected = query(connection, "annual", year=2024, network="2", modality="1")
        assert selected["total"] == 1
        assert selected["records"][0]["qt_desvinculado"] == 7
        unavailable = query(connection, "annual", year=2021)
        assert all(row["evasao_estimada_pct"] is None for row in unavailable["records"])
        assert all(row["status_estimativa"] == "sem_base_ano_anterior"
                   for row in unavailable["records"])
        assert query(connection, "records", family="censo_cursos", year=2024,
                     network="2", modality="1", municipality="5103403")["total"] == 1
        with pytest.raises(ValueError, match="estadual"):
            query(connection, "annual", course="11")
    manifest_path = output / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    replacement = write_source(folder, output, "cpc", [
        {"CO_UF": "51", "CO_IES": "9", "CO_CURSO": "12", "NU_ANO_REFERENCIA": 2024},
    ])
    manifest["files"] = [replacement if item["family"] == "cpc" else item
                         for item in manifest["files"]]
    manifest_path.write_text(json.dumps(manifest))
    with monkeypatch.context() as patch:
        def fail(*args):
            raise ValueError("Divergência simulada entre SQL e pandas.")
        patch.setattr("pipelines.load.validate_release", fail)
        with pytest.raises(ValueError, match="Divergência simulada"):
            load(folder, output, disposable_url)
    with connect(disposable_url, readonly=True) as connection:
        after = status(connection)
        assert before["active_release"] == after["active_release"]
        for table in ("raw.source_row", "staging.record", "control.source_file",
                      "analytics.annual_mt", "control.dataset_release"):
            assert before[table] == after[table]
        assert after["failed_runs"]
    retry = load(folder, output, disposable_url)
    assert retry["status"] == "loaded"
    assert retry["release_id"] != first["release_id"]
    with connect(disposable_url, readonly=True) as connection:
        assert status(connection)["active_release"] == retry["release_id"]
        assert connection.execute("SELECT count(*) total FROM control.dataset_release WHERE id=%s",
                                  (first["release_id"],)).fetchone()["total"] == 1


@pytest.mark.postgres
def test_altered_clean_data_is_not_published(disposable_url, sources):
    folder, output = sources
    load(folder, output, disposable_url)
    stage = output / "censo_cursos.parquet"
    frame = pd.read_parquet(stage)
    frame.loc[0, "QT_MAT"] = 9999
    frame.to_parquet(stage, index=False)
    with connect(disposable_url, readonly=True) as connection:
        before = status(connection)["active_release"]
    with pytest.raises(ValueError, match="Staging diverge da origem"):
        load(folder, output, disposable_url)
    with connect(disposable_url, readonly=True) as connection:
        assert status(connection)["active_release"] == before
