"""CLI de inventário, padronização e diagnóstico. Não escreve no PostgreSQL."""

import argparse
import json
import os
import platform
import sys
from pathlib import Path
from zipfile import ZipFile

import pandas as pd

from pipelines.extract import family, read_batches, sha256
from pipelines.transform import clean, mt_mask
from pipelines.validate import Profile

ROOT = Path(__file__).resolve().parents[1]
RULES_VERSION = "1.0.0"


def process(path: Path, output: Path, batch_size: int) -> dict:
    kind = family(path)
    original_checksum = sha256(path)
    inventory = {
        "file": path.name,
        "family": kind,
        "bytes": path.stat().st_size,
        "sha256": original_checksum,
        "status": "pending",
    }
    if path.suffix.lower() == ".ods":
        with ZipFile(path) as archive:
            inventory["content_xml_bytes"] = archive.getinfo("content.xml").file_size
        if not path.with_suffix(".xlsx").exists():
            raise ValueError("ODS requer exportação XLSX equivalente para leitura em lotes.")
        inventory["status"] = "alternative_format_not_loaded"
        inventory["reason"] = "XLSX selecionado; equivalência entre formatos não comprovada."
        return inventory
    if kind == "documentacao":
        inventory["status"] = "reference_not_loaded"
        return inventory
    profile = Profile()
    mt_profile = Profile()
    selected = []
    inventory["excluded_notes"] = []
    inventory["excluded_blank_rows"] = 0
    inventory["invalid_rows_national"] = 0
    inventory["error_samples"] = []
    for frame, row_start in read_batches(path, kind, batch_size):
        inventory["source_metadata"] = frame.attrs.get("source_metadata", {})
        inventory["excluded_notes"].extend(frame.attrs.get("excluded_notes", []))
        inventory["excluded_blank_rows"] += frame.attrs.get("excluded_blank_rows", 0)
        normalized, mapping, changed = clean(frame)
        profile.mappings = mapping
        profile.changed.update(changed)
        invalid = profile.update(normalized, kind)
        scope = mt_mask(normalized)
        mt_profile.update(normalized.loc[scope], kind)
        # IES nacionais são pequenas e necessárias para validar cursos fora da sede MT.
        keep = pd.Series(True, index=normalized.index) if kind == "censo_ies" else scope
        normalized["_SOURCE_ROW"] = pd.Series(
            frame.attrs.get("source_rows", range(row_start, row_start + len(frame))),
            index=frame.index,
        )
        normalized["_SOURCE_FILE"] = path.name
        normalized["_INVALID_ROW"] = invalid
        inventory["invalid_rows_national"] += int(invalid.sum())
        sample_columns = [c for c in normalized if c.startswith(("CO_", "_ORIGINAL_"))]
        sample_columns += ["_SOURCE_ROW", "_SOURCE_FILE"]
        remaining = max(0, 20 - len(inventory["error_samples"]))
        samples = normalized.loc[invalid, sample_columns].head(remaining)
        inventory["error_samples"].extend(
            json.loads(samples.to_json(orient="records", force_ascii=False))
        )
        selected.append(normalized.loc[keep].copy())
        print(f"  {path.name}: {profile.rows:,} linhas lidas", flush=True)
    data = pd.concat(selected, ignore_index=True).copy() if selected else pd.DataFrame()
    profile_result = profile.as_dict()
    inventory.update(profile_result)
    inventory["mt"] = mt_profile.as_dict()
    inventory["retained_rows"] = len(data)
    inventory["scope"] = "national_ies" if kind == "censo_ies" else "MT"
    if not data.empty:
        key = {
            "censo_cursos": [
                "NU_ANO_CENSO",
                "TP_DIMENSAO",
                "CO_IES",
                "CO_CURSO",
                "CO_REGIAO",
                "CO_UF",
                "CO_MUNICIPIO",
            ],
            "censo_ies": ["NU_ANO_CENSO", "CO_IES"],
            "trajetoria": [
                "CO_IES",
                "CO_CURSO",
                "NU_ANO_INGRESSO",
                "NU_ANO_REFERENCIA",
            ],
            "cpc": ["CO_CURSO", "NU_ANO_REFERENCIA"],
            "enade": ["CO_CURSO", "NU_ANO_REFERENCIA"],
        }.get(kind, [])
        data["_DUPLICATE_KEY"] = data.duplicated(key, keep=False) if key else False
        data["_REQUIRES_REVIEW"] = data["_INVALID_ROW"] | data["_DUPLICATE_KEY"]
        # Campos auxiliares de parsing ficam somente quando indicam um problema.
        drop = [c for c in data if c.startswith("_INVALID_") and c != "_INVALID_ROW"]
        data = data.drop(columns=drop)
        for column in data:
            if column.startswith(("QT_", "NU_ANO_")) and pd.api.types.is_numeric_dtype(
                data[column]
            ):
                if (data[column].dropna() % 1 == 0).all():
                    data[column] = data[column].astype("Int64")
        destination = output / "staging" / kind / f"{path.stem}.parquet"
        destination.parent.mkdir(parents=True, exist_ok=True)
        data.to_parquet(destination, index=False)
        inventory["staging"] = str(destination.relative_to(output))
        review = data.loc[data["_REQUIRES_REVIEW"]]
        inventory["review_rows"] = len(review)
        destination = output / "quarantine" / f"{path.stem}.parquet"
        if not review.empty:
            destination.parent.mkdir(parents=True, exist_ok=True)
            review.to_parquet(destination, index=False)
        elif destination.exists():
            destination.unlink()
    inventory["status"] = "processed"
    if sha256(path) != original_checksum:
        raise RuntimeError(f"Arquivo de origem mudou durante a execução: {path.name}")
    return inventory


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=ROOT / "dados")
    parser.add_argument("--output", type=Path, default=ROOT / "outputs" / "quality")
    parser.add_argument("--batch-size", type=int, default=25000)
    args = parser.parse_args()
    if args.batch_size < 1:
        parser.error("batch-size deve ser positivo")
    input_path, output = args.input.resolve(), args.output.resolve()
    if input_path == output or input_path in output.parents or output in input_path.parents:
        parser.error("Entrada e saída devem estar em árvores separadas.")
    files = sorted(p for p in input_path.iterdir() if p.is_file() and not p.name.startswith("."))
    if not files:
        parser.error("Nenhum arquivo encontrado.")
    output.mkdir(parents=True, exist_ok=True)
    manifest = {
        "rules_version": RULES_VERSION,
        "python": platform.python_version(),
        "pandas": pd.__version__,
        "scope": "MT",
        "files": [],
    }
    errors = 0
    for path in files:
        print(f"Iniciando {path.name}", flush=True)
        try:
            manifest["files"].append(process(path, output, args.batch_size))
        except Exception as error:
            errors += 1
            manifest["files"].append(
                {
                    "file": path.name,
                    "status": "failed",
                    "error_type": type(error).__name__,
                    "error": str(error),
                }
            )
            print(f"Falha em {path.name}: {type(error).__name__}: {error}", flush=True)
        (output / "manifest.json").write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
        )
    # Seaborn escreve cache somente na pasta local de saídas.
    os.environ.setdefault("MPLCONFIGDIR", str(output / ".matplotlib"))
    from pipelines.review import build_review

    build_review(manifest, output)
    if any(item.get("family") == "censo_cursos" for item in manifest["files"]):
        from pipelines.annual import build_annual

        build_annual(output)
    print(f"Relatório: {output / 'report.md'}", flush=True)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
