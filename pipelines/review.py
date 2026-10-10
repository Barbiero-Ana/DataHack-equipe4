"""Diagnóstico de granularidade, cobertura e reconciliação temporal."""

import json
from pathlib import Path

import pandas as pd

from pipelines.integrate import link_population_census


def trajectory_checks(frame: pd.DataFrame) -> tuple[dict, pd.DataFrame]:
    data = frame.sort_values(["CO_CURSO", "NU_ANO_INGRESSO", "NU_ANO_REFERENCIA"]).copy()
    group = data.groupby(["CO_IES", "CO_CURSO", "NU_ANO_INGRESSO"], dropna=False)
    data["ANO_ACOMPANHAMENTO"] = data["NU_ANO_REFERENCIA"] - data["NU_ANO_INGRESSO"] + 1
    data["FALECIMENTOS_ACUMULADOS"] = group["QT_FALECIDO"].cumsum()
    data["DENOMINADOR_AJUSTADO"] = data["QT_INGRESSANTE"] - data["FALECIMENTOS_ACUMULADOS"]
    checks = {
        "cohorts": sorted(data["NU_ANO_INGRESSO"].dropna().unique().tolist()),
        "reference_years": sorted(data["NU_ANO_REFERENCIA"].dropna().unique().tolist()),
        "cohort_ingress_count_changes": int(group["QT_INGRESSANTE"].nunique().gt(1).sum()),
        "nonpositive_adjusted_denominator": int(data["DENOMINADOR_AJUSTADO"].le(0).sum()),
        "missing_observation_years": int(group["NU_ANO_REFERENCIA"].diff().gt(1).sum()),
        "tda_decreasing": int(group["TDA"].diff().lt(-0.05).sum()),
        "tca_decreasing": int(group["TCA"].diff().lt(-0.05).sum()),
    }
    if "NU_ANO_MAXIMO_ACOMPANHAMENTO" in data:
        data["_AFTER_MAXIMUM_FOLLOWUP"] = data["NU_ANO_REFERENCIA"].gt(
            data["NU_ANO_MAXIMO_ACOMPANHAMENTO"]
        ).fillna(False)
        checks["rows_after_maximum_followup_year"] = int(
            data["_AFTER_MAXIMUM_FOLLOWUP"].sum()
        )
    denominator = data["DENOMINADOR_AJUSTADO"].where(data["DENOMINADOR_AJUSTADO"] > 0)
    computed = {
        "TAP": data["QT_PERMANENCIA"] / denominator * 100,
        "TCA": group["QT_CONCLUINTE"].cumsum() / denominator * 100,
        "TDA": group["QT_DESISTENCIA"].cumsum() / denominator * 100,
        "TCAN": data["QT_CONCLUINTE"] / denominator * 100,
        "TADA": data["QT_DESISTENCIA"] / denominator * 100,
    }
    for column, expected in computed.items():
        checks[f"{column}_count_formula_mismatch"] = int(
            expected.sub(data[column]).abs().gt(0.05).sum()
        )
    checks["cohort2015_presential_rows_2024"] = int(
        (
            data["NU_ANO_INGRESSO"].eq(2015)
            & data["NU_ANO_REFERENCIA"].eq(2024)
            & data["TP_MODALIDADE_ENSINO"].eq("1")
        ).sum()
    )
    # Derivações diagnósticas, não resultados finais do desafio.
    return checks, data


def join_coverage(left: pd.DataFrame, right: pd.DataFrame, keys: list[str]) -> dict:
    # pandas pode casar NULL com NULL: uma chave ausente não é correspondência.
    left_valid = left.dropna(subset=keys)
    right_valid = right.dropna(subset=keys)
    left_keys = left_valid[keys].drop_duplicates()
    right_keys = right_valid[keys].drop_duplicates()
    result = left_keys.merge(right_keys, on=keys, how="left", indicator=True, validate="one_to_one")
    matched = int(result["_merge"].eq("both").sum())
    return {
        "left_distinct_keys": len(left_keys),
        "matched": matched,
        "coverage_pct": round(matched / len(left_keys) * 100, 2) if len(left_keys) else None,
        "right_duplicate_rows": int(right_valid.duplicated(keys, keep=False).sum()),
        "left_rows_with_null_key": len(left) - len(left_valid),
        "right_rows_with_null_key": len(right) - len(right_valid),
        "note": "Cobertura por código, sem validar alinhamento temporal ou causalidade.",
    }


def build_review(manifest: dict, output: Path) -> None:
    frames = {}
    for item in manifest["files"]:
        if "staging" in item:
            frames.setdefault(item["family"], []).append(pd.read_parquet(output / item["staging"]))
    combined = {key: pd.concat(value, ignore_index=True) for key, value in frames.items()}
    diagnostics = {}
    diagnostics["network_rows_in_staging"] = {
        kind: {
            "publica": int(frame["DS_REDE"].eq("publica").sum()),
            "privada": int(frame["DS_REDE"].eq("privada").sum()),
            "pending": int(frame["REDE_PENDENTE"].sum()),
            "conflicts": int(frame["_NETWORK_CONFLICT"].sum()),
        }
        for kind, frame in combined.items() if "DS_REDE" in frame
    }
    if "trajetoria" in combined:
        checks, derived = trajectory_checks(combined["trajetoria"])
        diagnostics["trajectory_MT"] = checks
        derived.to_parquet(output / "trajectory_diagnostics_MT.parquet", index=False)
        course = combined["trajetoria"][["CO_CURSO"]]
        for kind in ["cpc", "enade"]:
            if kind in combined:
                diagnostics[f"trajectory_to_{kind}_MT"] = join_coverage(
                    course, combined[kind], ["CO_CURSO"]
                )
        if "enade" in combined:
            eligible = combined["trajetoria"].loc[
                combined["trajetoria"]["TP_GRAU_ACADEMICO"].eq("2"), ["CO_CURSO"]
            ]
            diagnostics["licenciatura_trajectory_to_enade_MT"] = join_coverage(
                eligible, combined["enade"], ["CO_CURSO"]
            )
    if {"censo_cursos", "censo_ies"} <= combined.keys():
        left = combined["censo_cursos"]
        right = combined["censo_ies"]
        diagnostics["census_to_ies"] = join_coverage(left, right, ["CO_IES", "NU_ANO_CENSO"])
        # Não substituir geografia de oferta pela geografia da sede.
        merged = left.merge(
            right[["CO_IES", "NU_ANO_CENSO", "CO_UF_IES"]],
            on=["CO_IES", "NU_ANO_CENSO"],
            how="left",
            validate="many_to_one",
        )
        diagnostics["MT_course_rows_with_IES_headquarters_outside_MT"] = int(
            merged["CO_UF_IES"].ne("51").fillna(False).sum()
        )
    if "populacao" in combined:
        diagnostics["population"] = {
            "rows_MT": len(combined["populacao"]),
            "municipality_code_present": "CO_MUNICIPIO" in combined["populacao"],
            "B1_status": "blocked_missing_municipal_population",
            "reference_year_from_workbook_metadata": next(
                (item.get("source_metadata", {}).get("reference_year")
                 for item in manifest["files"] if item.get("family") == "populacao"), None
            ),
            "population_MT_18_24": int(combined["populacao"]["QT_POP_18_24"].sum())
            if "QT_POP_18_24" in combined["populacao"] else None,
        }
        year = diagnostics["population"]["reference_year_from_workbook_metadata"]
        if "censo_cursos" in combined:
            linked = link_population_census(combined["censo_cursos"], combined["populacao"], year)
            linked.to_parquet(output / "population_census_2022_MT.parquet", index=False)
            diagnostics["population"]["census_2022_state_link"] = {
                "status": "validated_state_level",
                "keys": ["CO_UF", "NU_ANO_CENSO"],
                "cardinality": "one_to_one_after_aggregation",
                "result": linked.to_dict("records"),
                "municipal_B1": "pending_municipal_population_not_supplied_by_education_census",
            }
    (output / "diagnostics.json").write_text(
        json.dumps(diagnostics, ensure_ascii=False, indent=2, default=int),
        encoding="utf-8",
    )
    lines = [
        "# Diagnóstico das bases — Rota do Diploma",
        "",
        "Leitura integral dos arquivos selecionados; staging recortada para MT e IES nacionais.",
        (
            "Originais preservados. Registros com erros permanecem sinalizados; não "
            "houve imputação, deduplicação ou escrita no banco."
        ),
        "",
        (
            "| Arquivo | Estado | Linhas lidas | Linhas MT | Chaves repetidas (Brasil) "
            "| Erros técnicos (células/regras) |"
        ),
        "| --- | --- | ---: | ---: | ---: | ---: |",
    ]
    for item in manifest["files"]:
        lines.append(
            f"| {item['file']} | {item['status']} | {item.get('rows', '—')} | "
            f"{item.get('mt', {}).get('rows', '—')} | {item.get('duplicate_key_rows', '—')} | "
            f"{sum(item.get('errors', {}).values())} |"
        )
    lines += [
        "",
        (
            "As contagens de erro não equivalem a registros únicos; uma linha pode "
            "violar várias regras."
        ),
        "",
        "## Validações e cobertura",
        "",
        "```json",
        json.dumps(diagnostics, ensure_ascii=False, indent=2, default=int),
        "```",
        "",
        "## Pegadinhas metodológicas",
        "",
        "- Rede: 1 pública / 2 privada. Categoria administrativa 2 é pública estadual; "
        "não reutilizar o mesmo mapa para as duas colunas. Categoria especial sem "
        "rede original fica pendente. As contagens por rede são linhas, não pessoas.",
        (
            "- TP_DIMENSAO tem valores 1, 2, 3 e 4 nestes arquivos. Cursos aparecem "
            "em diferentes recortes; escolher a dimensão por indicador e confirmar "
            "seu significado no dicionário antes de agregar."
        ),
        (
            "- CO_UF/CO_MUNICIPIO vazios ou zero em dimensões agregadas não significam "
            "erro a preencher com a sede da IES."
        ),
        (
            "- QT_CONCLUINTE, QT_DESISTENCIA e QT_FALECIDO da trajetória são anuais; "
            "TCA e TDA são acumuladas. QT_INGRESSANTE repete a mesma coorte em cada "
            "ano."
        ),
        (
            "- A trajetória usa um denominador ajustado pelos falecimentos acumulados. "
            "Não fazer média simples de taxas ou somar ingressantes entre anos."
        ),
        (
            "- NU_ANO_MAXIMO_ACOMPANHAMENTO varia por curso: observações repetidas após"
            " o limite podem não representar novo acompanhamento."
        ),
        (
            "- P2 exige o mesmo ano de acompanhamento (referência − ingresso + 1), não "
            "simplesmente o mesmo ano civil."
        ),
        (
            "- O cabeçalho técnico é TADA; a descrição visual usa TDAN. Preservamos "
            "TADA como taxa de desistência anual."
        ),
        (
            "- Proficiência Enade aparece em proporção 0–1, embora o nome diga "
            "percentual. SC/ausência não é zero."
        ),
        (
            "- CPC avalia áreas em ciclos distintos. Junção apenas por curso com vários"
            " anos multiplica linhas; definir a edição por recorte e reportar "
            "cobertura."
        ),
        (
            "- Enade 2025 e trajetória até 2024 não identificam as mesmas pessoas. Um "
            "funil combinado deve explicitar essa diferença."
        ),
        (
            "- Financiamento é agregado por curso. FIES/ProUni podem se sobrepor; não "
            "somar modalidades sem confirmar exclusividade nem inferir efeito causal."
        ),
        (
            "- Desvinculação anual do Censo não é a TDA de uma coorte. Definir o "
            "denominador de P3 com a metodologia e tratar transferências separadamente."
        ),
        (
            "- Idades_tratadas foi ligada ao Censo 2022 por UF/ano. Tem UF/região, "
            "sem municípios. B1 precisa de população "
            "municipal 18–24, ano e códigos IBGE, incluindo municípios sem oferta."
        ),
        (
            "- XLSX e ODS de trajetória são formatos alternativos candidatos; somente "
            "XLSX foi carregado. Igualdade de conteúdo não foi presumida."
        ),
        (
            "- Dicionários oficiais não foram encontrados nesta pasta. Regras de "
            "categorias e dimensões permanecem pendentes de confirmação."
        ),
        (
            "- Células com menos de 10 alunos não devem aparecer em tabelas ou gráficos"
            " públicos, conforme o slide; arquivos staging locais não são uma "
            "publicação."
        ),
        "",
        (
            "Consulte manifest.json para hashes, mapeamentos de colunas, ausências, "
            "categorias e dimensões. Veja docs/data_quality.md para as decisões."
        ),
    ]
    (output / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    plot_missingness(manifest, output)


def plot_missingness(manifest: dict, output: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import seaborn as sns

    columns = [
        "CO_CURSO",
        "CO_MUNICIPIO",
        "CO_UF",
        "TAP",
        "TCA",
        "TDA",
        "CPC_CONTINUO",
        "PROFICIENCIA_PROPORCAO",
    ]
    records = {}
    for item in manifest["files"]:
        if item.get("rows"):
            records[item["file"]] = {
                col: item["missing"][col] / item["rows"] * 100
                if col in item["missing"]
                else float("nan")
                for col in columns
            }
    if not records:
        return
    table = pd.DataFrame.from_dict(records, orient="index")
    fig, ax = plt.subplots(figsize=(15, max(4, len(table) * 0.45)))
    sns.heatmap(
        table,
        vmin=0,
        vmax=100,
        cmap="YlOrRd",
        annot=True,
        fmt=".1f",
        ax=ax,
        cbar_kws={"label": "% ausente"},
    )
    ax.set_title("Ausências após padronização — leitura nacional; branco = coluna inexistente")
    ax.set_xlabel("")
    ax.set_ylabel("")
    fig.tight_layout()
    fig.savefig(output / "missingness.png", dpi=150)
    plt.close(fig)
