"""Compara as respostas HTTP analíticas com as consultas CLI, sem alterar o banco."""

import argparse
import json

import httpx

from pipelines.database import connect
from pipelines.query import query


def check(base_url: str):
    checks = 0
    with connect(readonly=True) as connection, httpx.Client(
        base_url=base_url.rstrip("/"), timeout=20,
    ) as client:
        for year in (None, 2021, 2022, 2023, 2024):
            for network in (None, "1", "2"):
                for modality in (None, "1", "2"):
                    filters = {"year": year, "network": network, "modality": modality}
                    response = client.get("/api/v1/analytics/annual", params={
                        key: value for key, value in filters.items() if value is not None
                    })
                    response.raise_for_status()
                    body = response.json()
                    expected = query(connection, "annual", **filters)
                    rows = [{k: v for k, v in row.items() if k != "release_id"}
                            for row in expected["records"]]
                    if (body["records"] != rows or body["total"] != len(rows)
                            or body["metadata"]["release_id"] != expected["release_id"]):
                        raise ValueError("Divergência de resultado ou versão entre HTTP e CLI.")
                    checks += 1
        response = client.get("/api/v1/analytics/population", params={"year": 2022})
        response.raise_for_status()
        body = response.json()
        expected = query(connection, "population", year=2022)
        rows = [{k: v for k, v in row.items() if k != "release_id"}
                for row in expected["records"]]
        if (body["records"] != rows
                or body["metadata"]["release_id"] != expected["release_id"]):
            raise ValueError("População diverge entre HTTP e CLI.")
    return {"status": "passed", "annual_filter_combinations": checks,
            "population": "passed", "release_id": expected["release_id"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    args = parser.parse_args()
    try:
        print(json.dumps(check(args.base_url), indent=2))
        return 0
    except Exception as error:
        print(json.dumps({"status": "failed", "error_type": type(error).__name__,
                          "message": "Confira API, conexão e identidade da versão ativa."}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
