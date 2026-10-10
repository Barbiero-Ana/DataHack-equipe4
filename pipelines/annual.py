"""Pergunta 3: balanço anual de matrículas e quantidade de desvinculações."""

import argparse
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_VERSION = "1.0.0"
GROUP = ["TP_REDE_PADRONIZADA", "TP_MODALIDADE_ENSINO"]
MEASURES = ["QT_MAT", "QT_ING", "QT_CONC", "QT_SIT_DESVINCULADO"]


def annual_indicators(frame: pd.DataFrame, years=(2021, 2022, 2023, 2024)) -> pd.DataFrame:
    """Razão dos totais por rede/modalidade; ano ausente não vira evasão zero."""
    required = set(GROUP + MEASURES + [
        "CO_UF", "NU_ANO_CENSO", "TP_DIMENSAO", "CO_IES", "CO_CURSO", "CO_MUNICIPIO",
    ])
    if missing := required - set(frame):
        raise ValueError(f"Colunas obrigatórias ausentes: {sorted(missing)}")
    relevant = frame["CO_UF"].eq("51") & frame["NU_ANO_CENSO"].between(min(years)-1, max(years))
    # Recorte espacial das matrículas: presencial/dimensão 1; EAD/dimensão 2.
    dimension = frame["TP_MODALIDADE_ENSINO"].map({"1": "1", "2": "2"})
    data = frame.loc[relevant & frame["TP_DIMENSAO"].eq(dimension)].copy()
    if not data[GROUP].isin(["1", "2"]).all().all():
        raise ValueError("Rede/modalidade ausente ou desconhecida no recorte.")
    if data[MEASURES].isna().any().any():
        raise ValueError("Medida ausente: não preencher com zero antes de agregar.")
    if ((data[MEASURES] < 0) | (data[MEASURES] % 1 != 0)).any().any():
        raise ValueError("Contagens negativas ou fracionárias no recorte.")
    key = ["NU_ANO_CENSO", "CO_IES", "CO_CURSO", "CO_MUNICIPIO", "TP_MODALIDADE_ENSINO"]
    if data[key].isna().any().any() or data.duplicated(key).any():
        raise ValueError("Chave ausente ou duplicada no recorte de oferta.")
    if "_REQUIRES_REVIEW" in data and data["_REQUIRES_REVIEW"].any():
        raise ValueError("Existem registros técnicos pendentes no recorte.")
    totals = data.groupby(["NU_ANO_CENSO"] + GROUP, as_index=False)[MEASURES].sum()
    counts = data.groupby(["NU_ANO_CENSO"] + GROUP).size().rename("QT_REGISTROS_OFERTA")
    totals = totals.merge(counts.reset_index(), on=["NU_ANO_CENSO"] + GROUP,
                          validate="one_to_one")
    prior = totals[["NU_ANO_CENSO"] + GROUP + ["QT_MAT", "QT_CONC"]].copy()
    prior["NU_ANO_CENSO"] += 1
    prior = prior.rename(columns={"QT_MAT": "QT_MAT_ANTERIOR", "QT_CONC": "QT_CONC_ANTERIOR"})
    grid = pd.MultiIndex.from_product([years, ["1", "2"], ["1", "2"]],
                                     names=["NU_ANO_CENSO"] + GROUP).to_frame(index=False)
    result = grid.merge(totals, on=["NU_ANO_CENSO"] + GROUP, how="left", validate="one_to_one")
    result = result.merge(prior, on=["NU_ANO_CENSO"] + GROUP, how="left", validate="one_to_one")
    result["NUMERADOR_PERMANENCIA"] = result["QT_MAT"] - result["QT_ING"]
    result["DENOMINADOR_PERMANENCIA"] = result["QT_MAT_ANTERIOR"] - result["QT_CONC_ANTERIOR"]
    current_missing = result[MEASURES].isna().any(axis=1)
    prior_missing = result[["QT_MAT_ANTERIOR", "QT_CONC_ANTERIOR"]].isna().any(axis=1)
    invalid_denominator = result["DENOMINADOR_PERMANENCIA"].le(0).fillna(False)
    valid = ~current_missing & ~prior_missing & ~invalid_denominator
    result["EVASAO_ESTIMADA_PCT"] = (
        100 * (1 - result["NUMERADOR_PERMANENCIA"] /
               result["DENOMINADOR_PERMANENCIA"].where(valid))
    ).astype("Float64")
    outside = (result["EVASAO_ESTIMADA_PCT"].lt(0)
               | result["EVASAO_ESTIMADA_PCT"].gt(100)).fillna(False)
    result["STATUS_ESTIMATIVA"] = "calculada"
    result.loc[outside, "STATUS_ESTIMATIVA"] = "revisar_estimativa_fora_0_100"
    result.loc[invalid_denominator, "STATUS_ESTIMATIVA"] = "denominador_nao_positivo"
    result.loc[prior_missing, "STATUS_ESTIMATIVA"] = "sem_base_ano_anterior"
    result.loc[current_missing, "STATUS_ESTIMATIVA"] = "sem_base_ano_atual"
    result["CO_UF"] = "51"
    result["ANO_BASE_ANTERIOR"] = result["NU_ANO_CENSO"] - 1
    result["DS_REDE"] = result["TP_REDE_PADRONIZADA"].map({"1": "publica", "2": "privada"})
    result["DS_MODALIDADE"] = result["TP_MODALIDADE_ENSINO"].map({"1": "presencial", "2": "ead"})
    result["CONTRACT_VERSION"] = CONTRACT_VERSION
    return result


def build_annual(output: Path) -> pd.DataFrame:
    manifest = json.loads((output / "manifest.json").read_text())
    sources = [item for item in manifest["files"] if item.get("family") == "censo_cursos"]
    if any(item["status"] != "processed" for item in sources):
        raise ValueError("Há uma fonte de cursos sem processamento concluído.")
    if not sources:
        raise ValueError("Não há Censo de cursos no manifest.")
    data = pd.concat([pd.read_parquet(output / item["staging"]) for item in sources],
                     ignore_index=True)
    result = annual_indicators(data)
    result.to_parquet(output / "p3_annual_MT.parquet", index=False)
    audit = {
        "contract_version": CONTRACT_VERSION,
        "method": "Lobo: 100 * (1 - (M_t - I_t) / (M_t-1 - C_t-1))",
        "source": "https://abmes.org.br/arquivos/publicacoes/Cadernos25.pdf",
        "input_files": [{"file": item["file"], "sha256": item["sha256"]} for item in sources],
        "status_counts": result["STATUS_ESTIMATIVA"].value_counts().to_dict(),
        "territory": "MT, geografia da oferta",
        "dimensions": {"presencial": "1", "ead": "2"},
        "publication_status": "diagnostico_local_pendente_confirmacao_dicionarios_e_totais",
        "note": "Desvinculações são quantidades; estimativa não é TADA nem rastreia indivíduos.",
    }
    (output / "p3_annual_audit.json").write_text(
        json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8",
    )
    lines = [
        "# Pergunta 3 — diagnóstico local de MT", "",
        "Método escolhido: estimativa anual por balanço de matrículas + desvinculações.",
        "Fórmula: `100 * (1 - (M_t - I_t) / (M_t-1 - C_t-1))`.",
        "Agregação por rede/modalidade antes da divisão; geografia da oferta em MT.",
        "Presencial: dimensão 1; EAD: dimensão 2. "
        "Confirmar dimensões e totais oficiais antes da publicação.",
        "", "| Ano | Rede | Modalidade | Matrículas | Desvinculações | "
        "Estimativa (%) | Estado |", "| --- | --- | --- | ---: | ---: | ---: | --- |",
    ]
    for row in result.to_dict("records"):
        estimate = row["EVASAO_ESTIMADA_PCT"]
        rendered = f"{estimate:.2f}" if pd.notna(estimate) else "—"
        counts = [str(int(row[col])) if pd.notna(row[col]) else "—"
                  for col in ["QT_MAT", "QT_SIT_DESVINCULADO"]]
        lines.append(
            f"| {row['NU_ANO_CENSO']} | {row['DS_REDE']} | {row['DS_MODALIDADE']} | "
            f"{counts[0]} | {counts[1]} | {rendered} | {row['STATUS_ESTIMATIVA']} |"
        )
    lines += [
        "", "Sem ano anterior, a estimativa fica ausente: 2021 requer o Censo 2020.",
        "Desvinculações são contagens de vínculos; não são o numerador da fórmula acima.",
        "Não interpretar essa estimativa como TADA ou como acompanhamento individual.",
        "Movimentos entre cursos, novas ofertas e mudanças de grupos afetam o balanço.",
        "Uma variação grande não comprova erro de origem; exige conferir seus componentes.",
        "Valores fora de 0–100% são preservados e sinalizados, sem truncamento.",
        "", "Referência: [Lobo, Cadernos ABMES 25, pp. 29–31]"
        "(https://abmes.org.br/arquivos/publicacoes/Cadernos25.pdf).",
        "Hashes das fontes em p3_annual_audit.json; numerador/denominador no Parquet.",
    ]
    (output / "p3_annual.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "outputs" / "quality")
    args = parser.parse_args()
    result = build_annual(args.output)
    print(result[["NU_ANO_CENSO", "DS_REDE", "DS_MODALIDADE", "QT_SIT_DESVINCULADO",
                  "EVASAO_ESTIMADA_PCT", "STATUS_ESTIMATIVA"]].to_string(index=False))


if __name__ == "__main__":
    main()
