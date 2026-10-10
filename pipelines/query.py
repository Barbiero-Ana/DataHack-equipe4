"""Validação e consultas filtradas no terminal, exclusivamente em modo leitura."""

import argparse
import json
from pathlib import Path

import pandas as pd

from pipelines.database import ROOT, active, connect, filters
from pipelines.load import FAMILIES, prepare, validate_release


def query(connection, command, *, year=None, network=None, modality=None,
          municipality=None, course=None, family=None, limit=20):
    release = active(connection)
    clause, parameters = filters(year, network, modality, municipality, course)
    parameters["release"] = release
    if command == "annual":
        if municipality is not None or course is not None:
            raise ValueError("A pergunta 3 é estadual; não admite filtro de curso/município.")
        rows = connection.execute(
            "SELECT * FROM analytics.annual_mt WHERE release_id=%(release)s" + clause
            + " ORDER BY year,network,modality", parameters,
        ).fetchall()
        return {"release_id": str(release), "total": len(rows), "records": rows,
                "network_enum": {"1": "publica", "2": "privada"},
                "modality_enum": {"1": "presencial", "2": "ead"},
                "scope": "MT, geografia da oferta; diagnóstico; estimativa não é TADA"}
    if command == "population":
        if any(value is not None for value in (network, modality, municipality, course)):
            raise ValueError("A população disponível é estadual; somente filtro de ano.")
        rows = connection.execute(
            "SELECT * FROM analytics.population_census_mt WHERE release_id=%(release)s" + clause,
            parameters,
        ).fetchall()
        return {"release_id": str(release), "records": rows, "geographic_level": "UF"}
    if family not in FAMILIES or not 1 <= limit <= 100:
        raise ValueError("Informe família válida e limite de 1 a 100.")
    parameters["family"] = family
    condition = " WHERE release_id=%(release)s AND family=%(family)s" + clause
    count = connection.execute("SELECT count(*) total FROM staging.record" + condition,
                               parameters).fetchone()["total"]
    parameters["limit"] = limit
    rows = connection.execute(
        "SELECT s.*,r.source_row,r.sheet,f.name source_name,f.sha256 source_sha256 "
        "FROM (SELECT * FROM staging.record" + condition
        + " ORDER BY raw_id LIMIT %(limit)s) s "
        "JOIN raw.source_row r ON r.id=s.raw_id "
        "JOIN control.source_file f ON f.id=r.source_file_id ORDER BY s.raw_id", parameters,
    ).fetchall()
    return {"release_id": str(release), "total": count, "returned": len(rows),
            "records": rows, "scope": "staging técnico; pendências preservadas"}


def status(connection):
    result = {}
    for schema, table in (
        ("control", "source_file"), ("control", "ingestion_run"),
        ("control", "dataset_release"), ("control", "quality_issue"),
        ("raw", "source_row"), ("staging", "record"),
        ("analytics", "annual_mt"), ("analytics", "population_census_mt"),
    ):
        result[f"{schema}.{table}"] = connection.execute(
            f"SELECT count(*) total FROM {schema}.{table}"
        ).fetchone()["total"]
    release = active(connection)
    result["active_release"] = str(release)
    result["by_family"] = connection.execute(
        "SELECT family,count(*) rows,count(*) FILTER(WHERE requires_review) review_rows "
        "FROM staging.record WHERE release_id=%s GROUP BY family ORDER BY family", (release,),
    ).fetchall()
    result["validation"] = connection.execute(
        "SELECT validation FROM control.dataset_release WHERE id=%s", (release,),
    ).fetchone()["validation"]
    result["failed_runs"] = connection.execute(
        "SELECT id,error_type,finished_at FROM control.ingestion_run WHERE status='failed'"
    ).fetchall()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command", choices=["status", "annual", "population", "records", "validate"],
    )
    parser.add_argument("--year", type=int)
    parser.add_argument("--network", choices=["1", "2"])
    parser.add_argument("--modality", choices=["1", "2"])
    parser.add_argument("--municipality")
    parser.add_argument("--course")
    parser.add_argument("--family", choices=sorted(FAMILIES))
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--input", type=Path, default=ROOT / "dados")
    parser.add_argument("--output", type=Path, default=ROOT / "outputs" / "quality")
    args = parser.parse_args()
    try:
        with connect(readonly=True) as connection:
            if args.command == "status":
                result = status(connection)
            elif args.command == "validate":
                prepared, fingerprint = prepare(args.input, args.output)
                release = active(connection)
                stored = connection.execute(
                    "SELECT fingerprint FROM control.dataset_release WHERE id=%s", (release,),
                ).fetchone()["fingerprint"]
                if stored != fingerprint:
                    raise ValueError("A versão ativa difere das fontes/artefatos locais.")
                frames = {}
                for item, _, frame, _ in prepared:
                    frames.setdefault(item["family"], []).append(frame)
                result = validate_release(connection, release,
                                          pd.concat(frames["censo_cursos"], ignore_index=True),
                                          pd.concat(frames["populacao"], ignore_index=True))
            else:
                result = query(connection, args.command, year=args.year, network=args.network,
                               modality=args.modality, municipality=args.municipality,
                               course=args.course, family=args.family, limit=args.limit)
        print(json.dumps(result, ensure_ascii=False, indent=2, default=str))
        return 0
    except Exception as error:
        message = (str(error) if isinstance(error, ValueError)
                   else "Confira a conexão e as migrations.")
        print(json.dumps({"status": "failed", "error_type": type(error).__name__,
                          "message": message}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
