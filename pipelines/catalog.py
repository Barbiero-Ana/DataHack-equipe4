"""Gera evidência leve e versionável de uma execução local concluída."""

import argparse
import json
from pathlib import Path

from pipelines.run import ROOT


def write_catalog(output: Path, destination: Path) -> None:
    manifest = json.loads((output / "manifest.json").read_text())
    if any(f["status"] == "failed" for f in manifest["files"]):
        raise ValueError("Corrija arquivos com falha antes de publicar o inventário.")
    diagnostics = json.loads((output / "diagnostics.json").read_text())
    lines = [
        "# Inventário da execução de qualidade",
        "",
        "Evidência gerada por `python -m pipelines.catalog`; dados originais fora do Git.",
        f"Python {manifest['python']}; pandas {manifest['pandas']}; "
        f"regras {manifest['rules_version']}; recorte MT, com IES nacionais para cruzamento.",
        "",
        "| Arquivo | MiB | Estado | Linhas Brasil | Linhas MT | Erros técnicos |",
        "| --- | ---: | --- | ---: | ---: | ---: |",
    ]
    for item in manifest["files"]:
        lines.append(
            f"| {item['file']} | {item.get('bytes', 0) / 2**20:.2f} | "
            f"{item['status']} | {item.get('rows', '—')} | "
            f"{item.get('mt', {}).get('rows', '—')} | "
            f"{sum(item.get('errors', {}).values())} |"
        )
    lines += [
        "", "Erros são células/regras, não necessariamente pessoas ou linhas distintas.",
        "Leitura integral dos arquivos tabulares selecionados; ODS alternativo não carregado.",
        "Não foram eliminadas duplicatas ou imputados valores. "
        "Hashes são conferidos antes e depois.",
        "", "## Diagnóstico do recorte", "", "```json",
        json.dumps(diagnostics, ensure_ascii=False, indent=2), "```",
        "", "## Alterações de esquema do Censo", "",
    ]
    prior = set()
    for item in manifest["files"]:
        if item.get("family") != "censo_cursos":
            continue
        columns = set(item["column_mapping"].values())
        lines.append(f"- {item['file']}: {len(columns)} colunas de origem normalizadas.")
        if prior:
            lines.append(f"  Acrescentadas: {', '.join(sorted(columns - prior)) or 'nenhuma'}.")
            lines.append(f"  Removidas: {', '.join(sorted(prior - columns)) or 'nenhuma'}.")
        prior = columns
    lines += ["", "## Problemas e classificação", ""]
    for item in manifest["files"]:
        if item.get("errors"):
            lines.append(f"- {item['file']}: `{json.dumps(item['errors'], ensure_ascii=False)}`.")
            for sample in item.get("error_samples", []):
                originals = {k: v for k, v in sample.items() if k.startswith("_ORIGINAL_")}
                lines.append(
                    f"  Linha {sample['_SOURCE_ROW']}, curso {sample.get('CO_CURSO')}: "
                    f"`{json.dumps(originals, ensure_ascii=False)}`."
                )
    lines += [
        "", "Rede padronizada: 1 pública / 2 privada. Categoria administrativa 2 é pública",
        "estadual. Categoria especial sem rede fica pendente, conforme docs/data_quality.md.",
        "", "## SHA-256 dos originais", "",
        "| Arquivo | SHA-256 |", "| --- | --- |",
    ]
    lines += [f"| {item['file']} | `{item['sha256']}` |" for item in manifest["files"]]
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "outputs" / "quality")
    parser.add_argument("--destination", type=Path, default=ROOT / "docs" / "data_inventory.md")
    args = parser.parse_args()
    write_catalog(args.output, args.destination)


if __name__ == "__main__":
    main()
