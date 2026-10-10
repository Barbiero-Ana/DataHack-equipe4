"""Carga transacional das fontes verificadas: control → raw → staging → analytics."""

import argparse
import hashlib
import json
from pathlib import Path
from uuid import uuid4

import pandas as pd
from psycopg.types.json import Jsonb

from pipelines.annual import annual_indicators
from pipelines.database import ROOT, connect, records
from pipelines.extract import normalize_header, read_batches, sha256
from pipelines.integrate import link_population_census
from pipelines.run import RULES_VERSION
from pipelines.transform import ALIASES, clean, mt_mask

LOADER_VERSION = "1.0.1"
FAMILIES = {"censo_cursos", "censo_ies", "trajetoria", "cpc", "enade", "populacao"}
STAGE_COLUMNS = (
    "release_id", "raw_id", "family", "year", "uf", "municipality", "ies", "course",
    "network", "modality", "dimension", "requires_review", "qt_mat", "qt_ing", "qt_conc",
    "qt_desvinculado", "qt_vg_total", "payload",
)


def prepare(input_path: Path, output: Path):
    manifest = json.loads((output / "manifest.json").read_text())
    if manifest["rules_version"] != RULES_VERSION:
        raise ValueError("Reprocesse a limpeza com a versão atual das regras.")
    items = [item for item in manifest["files"] if item.get("family") in FAMILIES
             and item.get("status") != "alternative_format_not_loaded"]
    if {item["family"] for item in items} != FAMILIES:
        raise ValueError("A publicação conjunta exige as seis famílias.")
    prepared = []
    for item in items:
        print(f"Verificando origem: {item['file']}", flush=True)
        if item["status"] != "processed":
            raise ValueError("Uma fonte não terminou seu processamento.")
        source = (input_path / item["file"]).resolve()
        stage = (output / item["staging"]).resolve()
        if input_path.resolve() not in source.parents or output.resolve() not in stage.parents:
            raise ValueError("Arquivo fora da árvore declarada.")
        if sha256(source) != item["sha256"]:
            raise ValueError(f"Origem mudou: {item['file']}; reprocesse a limpeza.")
        frame = pd.read_parquet(stage)
        if len(frame) != item["retained_rows"] or frame["_SOURCE_ROW"].duplicated().any():
            raise ValueError("Contagem/chave de rastreabilidade divergente.")
        prepared.append((item, source, frame, sha256(stage)))
    code_files = [ROOT / "pipelines" / f"{name}.py" for name in
                  ("load", "database", "extract", "transform", "annual", "integrate")]
    code_files += [ROOT / "sql" / "build_analytics.sql"]
    identity = {"loader": LOADER_VERSION, "rules": RULES_VERSION,
                "implementation": [(path.name, sha256(path)) for path in code_files],
                "files": [(item["file"], item["sha256"], digest)
                          for item, _, _, digest in prepared]}
    fingerprint = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
    return prepared, fingerprint


def integer(row, key):
    value = row.get(key)
    if value is None:
        return None
    if float(value) % 1:
        raise ValueError(f"Contagem/ano fracionário: {key}")
    return int(value)


def stage_values(release, raw_id, kind, row):
    year = integer(row, "NU_ANO_CENSO") or integer(row, "NU_ANO_REFERENCIA")
    uf = row.get("CO_UF") or row.get("CO_UF_IES")
    if row.get("SG_UF") == "MT":
        uf = "51"
    if kind == "populacao":
        year, uf = 2022, "51"
        for count in ("QT_POP_18_19", "QT_POP_20_24", "QT_POP_18_24"):
            integer(row, count)
    modality = row.get("TP_MODALIDADE_ENSINO")
    if modality is None:
        modality = {"Presencial": "1", "EaD": "2", "Educação Presencial": "1",
                    "Educação a Distância": "2"}.get(row.get("DS_MODALIDADE_ENSINO"))
    return (release, raw_id, kind, year, uf,
            row.get("CO_MUNICIPIO") or row.get("CO_MUNICIPIO_IES"),
            row.get("CO_IES"), row.get("CO_CURSO"), row.get("TP_REDE_PADRONIZADA"),
            modality, row.get("TP_DIMENSAO"), bool(row["_REQUIRES_REVIEW"]),
            integer(row, "QT_MAT"), integer(row, "QT_ING"), integer(row, "QT_CONC"),
            integer(row, "QT_SIT_DESVINCULADO"), integer(row, "QT_VG_TOTAL"), Jsonb(row))


def ingest_source(connection, release, item, source, frame):
    print(f"Lendo original: {item['file']}", flush=True)
    if item["family"] == "populacao" and item["source_metadata"].get("reference_year") != 2022:
        raise ValueError("A população deve declarar 2022 nos metadados da origem.")
    metadata = {key: item.get(key) for key in (
        "source_metadata", "excluded_notes", "excluded_blank_rows", "scope", "rows",
        "retained_rows", "invalid_rows_national", "error_samples",
    )}
    source_id = connection.execute(
        "INSERT INTO control.source_file(name,family,sha256,bytes,original_uri,metadata) "
        "VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT(name,sha256) DO UPDATE SET name=EXCLUDED.name "
        "RETURNING id",
        (item["file"], item["family"], item["sha256"], source.stat().st_size,
         source.as_uri(), Jsonb(metadata)),
    ).fetchone()["id"]
    sheet = item.get("source_metadata", {}).get("sheet", "CSV")
    indexed = {int(row["_SOURCE_ROW"]): row for row in records(frame)}
    matched, scoped = set(), set()
    connection.execute("CREATE TEMP TABLE incoming_raw (source_row BIGINT, payload JSONB) "
                       "ON COMMIT DELETE ROWS")
    for original, start in read_batches(source, item["family"], 25000):
        line_numbers = original.attrs.get("source_rows", list(range(start, start+len(original))))
        if item["family"] == "censo_ies":
            scope = pd.Series(True, index=original.index)
        else:
            geography = [col for col in original if
                         ALIASES.get(normalize_header(col), normalize_header(col)) in
                         {"CO_UF", "CO_UF_IES", "SG_UF", "PAIS_REGIOES_ESTADOS"}]
            scope = mt_mask(clean(original[geography])[0])
        scoped.update(line for line, keep in zip(line_numbers, scope, strict=True) if keep)
        selected = [i for i, line in enumerate(line_numbers) if line in indexed]
        if not selected:
            continue
        raw_frame = original.iloc[selected]
        normalized = clean(raw_frame)[0]
        raw_rows, normalized_rows = records(raw_frame), records(normalized)
        with connection.cursor().copy("COPY incoming_raw(source_row,payload) FROM STDIN") as copy:
            for position, raw, cleaned in zip(selected, raw_rows, normalized_rows, strict=True):
                line = line_numbers[position]
                row = indexed[line]
                for key, value in cleaned.items():
                    if key.startswith("_"):
                        continue
                    if row.get(key) != value:
                        raise ValueError(f"Staging diverge da origem: {item['file']}:{line}:{key}")
                matched.add(line)
                copy.write_row((line, Jsonb(raw)))
        connection.execute(
            "INSERT INTO raw.source_row(source_file_id,sheet,source_row,payload) "
            "SELECT %s,%s,source_row,payload FROM incoming_raw "
            "ON CONFLICT(source_file_id,sheet,source_row) DO NOTHING", (source_id, sheet),
        )
        connection.execute("DELETE FROM incoming_raw")
    connection.execute("DROP TABLE incoming_raw")
    if (matched != set(indexed) or scoped != set(indexed)
            or sha256(source) != item["sha256"]):
        raise ValueError("Origem incompleta ou alterada durante a carga.")
    raw_ids = connection.execute(
        "SELECT id,source_row FROM raw.source_row WHERE source_file_id=%s AND sheet=%s",
        (source_id, sheet),
    ).fetchall()
    rows = {row["source_row"]: row["id"] for row in raw_ids}
    with connection.cursor().copy(
        f"COPY staging.record({','.join(STAGE_COLUMNS)}) FROM STDIN"
    ) as copy:
        for line, row in indexed.items():
            copy.write_row(stage_values(release, rows[line], item["family"], row))
    connection.execute(
        "INSERT INTO control.release_source VALUES (%s,%s,%s)",
        (release, source_id, len(frame)),
    )
    connection.execute(
        "INSERT INTO control.quality_issue "
        "SELECT release_id,raw_id,'technical_review','error',"
        "'Parsing, chave ou regra técnica pendente; consultar payload e origem' "
        "FROM staging.record WHERE release_id=%s AND family=%s AND requires_review "
        "ON CONFLICT DO NOTHING", (release, item["family"]),
    )
    connection.execute(
        "INSERT INTO control.quality_issue "
        "SELECT release_id,raw_id,'network_pending','warning','Rede não resolvida na edição' "
        "FROM staging.record WHERE release_id=%s AND family=%s "
        "AND payload->>'REDE_PENDENTE'='true' ON CONFLICT DO NOTHING",
        (release, item["family"]),
    )
    print(f"Carregado: {item['file']} — {len(frame):,} registros", flush=True)


def compare_frames(actual, expected, key):
    # IDs/inteiros podem chegar em tipos diferentes; números com tolerância de ponto flutuante.
    actual = actual.sort_values(key).reset_index(drop=True).convert_dtypes()
    expected = expected.sort_values(key).reset_index(drop=True).convert_dtypes()
    for col in expected:
        if actual[col].isna().all() and expected[col].isna().all():
            actual[col] = pd.Series(pd.NA, index=actual.index, dtype="Float64")
            expected[col] = pd.Series(pd.NA, index=expected.index, dtype="Float64")
    pd.testing.assert_frame_equal(actual[expected.columns], expected,
                                  check_dtype=False, check_exact=False, rtol=1e-10, atol=1e-10)


def validate_release(connection, release, census, population):
    lineage = connection.execute(
        "SELECT count(*) FILTER(WHERE s.family<>f.family) bad_family "
        "FROM staging.record s JOIN raw.source_row r ON r.id=s.raw_id "
        "JOIN control.source_file f ON f.id=r.source_file_id WHERE s.release_id=%s",
        (release,),
    ).fetchone()
    mismatched = connection.execute(
        "SELECT count(*) total FROM control.release_source l WHERE l.release_id=%s "
        "AND l.retained_rows<>(SELECT count(*) FROM staging.record s "
        "JOIN raw.source_row r ON r.id=s.raw_id "
        "WHERE s.release_id=l.release_id AND r.source_file_id=l.source_file_id)",
        (release,),
    ).fetchone()
    if lineage["bad_family"] or mismatched["total"]:
        raise ValueError("Contagem ou linhagem diverge no banco.")
    expected = annual_indicators(census)
    actual = pd.DataFrame(connection.execute(
        "SELECT * FROM analytics.annual_mt WHERE release_id=%s", (release,),
    ).fetchall()).rename(columns={
        "year": "NU_ANO_CENSO", "network": "TP_REDE_PADRONIZADA",
        "modality": "TP_MODALIDADE_ENSINO", "uf": "CO_UF", "qt_desvinculado": "QT_SIT_DESVINCULADO",
    })
    actual = actual.rename(columns={col: col.upper() for col in actual if col.islower()})
    cols = [col for col in expected if col in actual]
    key = ["NU_ANO_CENSO", "TP_REDE_PADRONIZADA", "TP_MODALIDADE_ENSINO"]
    compare_frames(actual[cols], expected[cols], key)
    checks = 0
    for year in (None, 2021, 2022, 2023, 2024):
        for network in (None, "1", "2"):
            for modality in (None, "1", "2"):
                queried = pd.DataFrame(connection.execute(
                    "SELECT year,network,modality,qt_desvinculado,evasao_estimada_pct "
                    "FROM analytics.annual_mt WHERE release_id=%s "
                    "AND (%s::int IS NULL OR year=%s) AND (%s::text IS NULL OR network=%s) "
                    "AND (%s::text IS NULL OR modality=%s)",
                    (release, year, year, network, network, modality, modality),
                ).fetchall()).rename(columns={
                    "year": key[0], "network": key[1], "modality": key[2],
                    "qt_desvinculado": "QT_SIT_DESVINCULADO",
                    "evasao_estimada_pct": "EVASAO_ESTIMADA_PCT",
                })
                mask = pd.Series(True, index=expected.index)
                for field, value in zip(key, (year, network, modality), strict=True):
                    if value is not None:
                        mask &= expected[field].eq(value)
                compare_frames(queried, expected.loc[mask, queried.columns], key)
                checks += 1
    linked = link_population_census(census, population, 2022)
    queried = pd.DataFrame(connection.execute(
        "SELECT * FROM analytics.population_census_mt WHERE release_id=%s", (release,),
    ).fetchall()).rename(columns={"year": "NU_ANO_CENSO", "uf": "CO_UF"})
    queried = queried.rename(columns={col: col.upper() for col in queried if col.islower()})
    compare_frames(queried[linked.columns], linked, ["CO_UF", "NU_ANO_CENSO"])
    return {"sql_pandas": "passed", "lineage_counts": "passed",
            "annual_filter_combinations": checks,
            "annual_rows": len(actual), "population_rows": len(linked),
            "scope": "MT; IES nacionais", "publication": "diagnostico",
            "pending": ["dicionarios oficiais", "Censo 2020", "populacao municipal"]}


def load(input_path=ROOT / "dados", output=ROOT / "outputs" / "quality", url=None):
    prepared, fingerprint = prepare(input_path, output)
    frames = {}
    for item, _, frame, _ in prepared:
        frames.setdefault(item["family"], []).append(frame)
    census = pd.concat(frames["censo_cursos"], ignore_index=True)
    population = pd.concat(frames["populacao"], ignore_index=True)
    # Valida contratos antes de escrever qualquer registro.
    annual_indicators(census)
    link_population_census(census, population, 2022)
    run = uuid4()
    with connect(url) as connection:
        # Lock de sessão serializa cargas e publicação, inclusive reexecuções.
        connection.execute("SELECT pg_advisory_lock(5102022)")
        connection.commit()
        existing = connection.execute(
            "SELECT id,validation FROM control.dataset_release WHERE fingerprint=%s",
            (fingerprint,),
        ).fetchone()
        if existing:
            return {"status": "already_loaded", "release_id": str(existing["id"]),
                    "validation": existing["validation"]}
        connection.execute(
            "INSERT INTO control.ingestion_run(id,fingerprint,rules_version,status) "
            "VALUES (%s,%s,%s,'running')", (run, fingerprint, RULES_VERSION),
        )
        connection.commit()
        try:
            connection.execute(
                "INSERT INTO control.dataset_release(id,fingerprint,contract_version,validation) "
                "VALUES (%s,%s,%s,'{}')", (run, fingerprint, LOADER_VERSION),
            )
            for item, source, frame, _ in prepared:
                ingest_source(connection, run, item, source, frame)
            for statement in (ROOT / "sql" / "build_analytics.sql").read_text().split(";"):
                if statement.strip():
                    connection.execute(statement, {"release": run})
            validation = validate_release(connection, run, census, population)
            connection.execute("UPDATE control.dataset_release SET validation=%s WHERE id=%s",
                               (Jsonb(validation), run))
            connection.execute(
                "UPDATE control.ingestion_run SET status='validated',finished_at=now(),summary=%s "
                "WHERE id=%s", (Jsonb(validation), run),
            )
            connection.execute(
                "INSERT INTO control.active_release(product,release_id) "
                "VALUES ('diagnostico_mt',%s) "
                "ON CONFLICT(product) DO UPDATE SET "
                "release_id=EXCLUDED.release_id,activated_at=now()",
                (run,),
            )
            connection.commit()
            return {"status": "loaded", "release_id": str(run), "validation": validation}
        except Exception as error:
            connection.rollback()
            connection.execute(
                "UPDATE control.ingestion_run SET status='failed',finished_at=now(),error_type=%s "
                "WHERE id=%s", (type(error).__name__, run),
            )
            connection.commit()
            raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=ROOT / "dados")
    parser.add_argument("--output", type=Path, default=ROOT / "outputs" / "quality")
    args = parser.parse_args()
    try:
        print(json.dumps(load(args.input, args.output), ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        # SQL/DSNs e valores sensíveis não entram no terminal.
        print(json.dumps({"status": "failed", "error_type": type(error).__name__,
                          "message": "Carga interrompida; versão ativa preservada. "
                          "Confira conexão, migrations, manifest e validação das fontes."}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
