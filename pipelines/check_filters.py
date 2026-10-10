"""Confere filtros reais de staging no PostgreSQL contra os Parquet em pandas."""

import argparse
import json
from pathlib import Path

import pandas as pd

from pipelines.database import ROOT, active, connect
from pipelines.load import prepare
from pipelines.query import query

# Casos observados nas fontes atuais; a pergunta 3 tem sua matriz de 45 casos separada.
CASES = [
    ("censo_cursos", 2024, "2", "1", "5103403"),
    ("trajetoria", 2024, "1", "1", None),
    ("cpc", 2023, "2", "2", None),
    ("enade", 2025, "2", "2", None),
]
MODALITIES = {
    "Educação Presencial": "1", "Educação a Distância": "2", "Presencial": "1", "EaD": "2",
}


def check(input_path: Path, output: Path):
    prepared, fingerprint = prepare(input_path, output)
    families = {}
    for item, _, frame, _ in prepared:
        families.setdefault(item["family"], []).append(frame)
    families = {family: pd.concat(frames, ignore_index=True)
                for family, frames in families.items()}
    checks = []
    with connect(readonly=True) as connection:
        release = active(connection)
        stored = connection.execute(
            "SELECT fingerprint FROM control.dataset_release WHERE id=%s", (release,),
        ).fetchone()["fingerprint"]
        if stored != fingerprint:
            raise ValueError("A versão ativa difere dos arquivos e do código locais.")
        for family, year, network, modality, municipality in CASES:
            frame = families[family]
            year_column = "NU_ANO_CENSO" if "NU_ANO_CENSO" in frame else "NU_ANO_REFERENCIA"
            modes = (frame["TP_MODALIDADE_ENSINO"] if "TP_MODALIDADE_ENSINO" in frame
                     else frame["DS_MODALIDADE_ENSINO"].map(MODALITIES))
            mask = (frame[year_column].eq(year) & frame["TP_REDE_PADRONIZADA"].eq(network)
                    & modes.eq(modality))
            if municipality:
                mask &= frame["CO_MUNICIPIO"].eq(municipality)
            expected = int(mask.sum())
            actual = query(connection, "records", family=family, year=year, network=network,
                           modality=modality, municipality=municipality, limit=1)["total"]
            if actual != expected:
                raise ValueError(f"Filtro divergente em {family}: SQL={actual}, pandas={expected}")
            checks.append({"family": family, "year": year, "network": network,
                           "modality": modality, "municipality": municipality,
                           "sql": actual, "pandas": expected})
        frame = families["censo_cursos"]
        course = str(frame["CO_CURSO"].dropna().iloc[0])
        actual = query(connection, "records", family="censo_cursos", course=course, limit=1)
        expected = int(frame["CO_CURSO"].eq(course).sum())
        if actual["total"] != expected:
            raise ValueError("Filtro de curso divergente.")
        checks.append({"family": "censo_cursos", "course": course,
                       "sql": actual["total"], "pandas": expected})
        # Garante que não houve troca de versão entre consultas durante a verificação.
        if active(connection) != release:
            raise ValueError("A versão ativa mudou; repita a validação.")
    return {"release_id": str(release), "status": "passed", "checks": checks}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=ROOT / "dados")
    parser.add_argument("--output", type=Path, default=ROOT / "outputs" / "quality")
    args = parser.parse_args()
    try:
        print(json.dumps(check(args.input, args.output), indent=2, ensure_ascii=False))
        return 0
    except Exception as error:
        message = str(error) if isinstance(error, ValueError) else "Verifique conexão e arquivos."
        print(json.dumps({"status": "failed", "error_type": type(error).__name__,
                          "message": message}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
