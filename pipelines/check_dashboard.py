"""Confere produtos gráficos persistidos com pandas e filtros HTTP reais."""

import argparse
import json
from pathlib import Path

import httpx
import pandas as pd

from pipelines.dashboard import build
from pipelines.database import active, connect


def check(base_url):
    root = Path(__file__).resolve().parents[1] / "outputs" / "quality"
    manifest = json.loads((root / "manifest.json").read_text())
    frames = {
        family: pd.concat(
            [
                pd.read_parquet(root / item["staging"])
                for item in manifest["files"]
                if item["family"] == family and "staging" in item
            ],
            ignore_index=True,
        )
        for family in ("trajetoria", "cpc", "enade", "censo_cursos")
    }
    expected, audit = build(frames)
    with connect(readonly=True) as connection:
        release = active(connection)
        stored = connection.execute(
            "SELECT payload,audit FROM analytics.dashboard_mt WHERE release_id=%s", (release,)
        ).fetchone()
        if stored and "municipal_population" in stored["payload"]:
            from pipelines.municipal_population import enrich, read_source

            _, population, provenance = read_source()
            enrich(expected, audit, population, provenance)
        if stored is None or stored["payload"] != expected or stored["audit"] != audit:
            raise ValueError("Produtos do banco divergem da reconstrução pandas.")
    cases = [
        {},
        {"network": "1"},
        {"network": "2"},
        {"degree": "2"},
        {"municipality": "5103403"},
        {"network": "2", "degree": "2", "modality": "1"},
    ]
    with httpx.Client(base_url=base_url, timeout=30) as client:
        for filters in cases:
            response = client.get("/api/v1/analytics/dashboard", params=filters)
            response.raise_for_status()
            body = response.json()
            assert body["metadata"]["release_id"] == str(release)
            for product in (
                "courses",
                "trajectory",
                "cpc",
                "enade",
                "funding_relationship",
                "municipal",
                "municipal_population",
            ):
                applicable = {
                    key: value
                    for key, value in filters.items()
                    if (product == "municipal_population" and key == "municipality")
                    or (product == "municipal" and key in ("network", "municipality"))
                    or product not in ("municipal", "municipal_population")
                }
                rows = [
                    row
                    for row in expected.get(product, [])
                    if all(row.get(k) == v for k, v in applicable.items())
                ]
                assert body["data"].get(product, []) == rows, (product, filters)
            finance = {}
            for row in expected["finance"]:
                if not all(row.get(k) == v for k, v in filters.items()):
                    continue
                key = (row["year"], row["modality"])
                target = finance.setdefault(
                    key,
                    {
                        "year": key[0],
                        "modality": key[1],
                        "matriculated": 0,
                        "fies": 0,
                        "prouni_full": 0,
                        "prouni_partial": 0,
                    },
                )
                for col in ("matriculated", "fies", "prouni_full", "prouni_partial"):
                    target[col] += row[col]
            assert body["data"]["finance"] == [
                row for row in finance.values() if row["matriculated"] >= 10
            ]
        for filters in ({"network": "3"}, {"degree": "4"}, {"municipality": "abc"}, {"year": 2024}):
            assert client.get("/api/v1/analytics/dashboard", params=filters).status_code == 422
    totals = {
        key: sum(row[key] for row in expected["courses"])
        for key in ("ingress", "denominator", "dropout", "concluded", "remaining")
    }
    result = {
        "status": "passed",
        "release_id": str(release),
        "product_sets": len(expected),
        "http_filter_cases": len(cases),
        "invalid_filters": 4,
        "trajectory_counts": totals,
    }
    destination = root.parent / "dashboard" / "validation.json"
    destination.write_text(json.dumps(result, indent=2))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    args = parser.parse_args()
    try:
        print(json.dumps(check(args.base_url), indent=2))
    except Exception as error:
        print(
            json.dumps(
                {
                    "status": "failed",
                    "type": type(error).__name__,
                    "message": "Confira produtos pandas, banco e API.",
                }
            )
        )
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
