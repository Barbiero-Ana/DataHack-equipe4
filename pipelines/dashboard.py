"""Produtos gráficos reais: pandas, cruzamentos auditáveis e publicação em analytics."""

import argparse
import json
from pathlib import Path

import pandas as pd
from psycopg.types.json import Jsonb

from pipelines.database import active, connect, records
from pipelines.review import trajectory_checks

CONTRACT = "dashboard-1.0.0"
KEY = ["CO_IES", "CO_CURSO"]
COMPONENTS = {
    "CPC": "CPC_CONTINUO",
    "Enade": "CONCEITO_ENADE_CONTINUO",
    "IDD": "NOTA_PADRONIZADA_IDD",
    "Mestres": "NOTA_PADRONIZADA_MESTRES",
    "Doutores": "NOTA_PADRONIZADA_DOUTORES",
    "Infraestrutura": "NOTA_PADRONIZADA_INFRAESTRUTURA_E_INSTALACOES_FISICAS",
    "Organização didática": "NOTA_PADRONIZADA_ORGANIZACAO_DIDATICO_PEDAGOGICA",
    "Regime de trabalho": "NOTA_PADRONIZADA_REGIME_DE_TRABALHO",
}


def safe(frame):
    if "_REQUIRES_REVIEW" in frame:
        return frame.loc[~frame["_REQUIRES_REVIEW"].fillna(True)].copy()
    return frame.copy()


def unique(frame, keys):
    if frame[keys].isna().any().any() or frame.duplicated(keys).any():
        raise ValueError("Chave ausente/duplicada no produto; publicação cancelada.")


def trajectory(frame):
    data = safe(frame)
    data = data.loc[
        data["NU_ANO_INGRESSO"].eq(2015)
        & data["TP_MODALIDADE_ENSINO"].eq("1")
        & data["CO_UF"].eq("51")
        & data["NU_ANO_REFERENCIA"].between(2015, 2024)
    ].copy()
    unique(data, KEY + ["NU_ANO_INGRESSO", "NU_ANO_REFERENCIA"])
    counts = ["QT_INGRESSANTE", "QT_PERMANENCIA", "QT_CONCLUINTE", "QT_DESISTENCIA", "QT_FALECIDO"]
    if (
        data[counts].isna().any().any()
        or (data[counts] < 0).any().any()
        or (data[counts] % 1 != 0).any().any()
    ):
        raise ValueError("Contagens da trajetória ausentes, negativas ou fracionárias.")
    checks, data = trajectory_checks(data)
    for key, value in checks.items():
        if (
            "mismatch" in key
            or key
            in (
                "cohort_ingress_count_changes",
                "nonpositive_adjusted_denominator",
                "missing_observation_years",
            )
        ) and value:
            raise ValueError(f"Falha na reconciliação da trajetória: {key}")
    # Não recontar ingressantes entre referências; contagens anuais são acumuladas uma vez.
    group = data.groupby(KEY + ["NU_ANO_INGRESSO"])
    data["concluded"] = group["QT_CONCLUINTE"].cumsum()
    data["dropout"] = group["QT_DESISTENCIA"].cumsum()
    mapping = {
        "CO_IES": "ies",
        "CO_CURSO": "course",
        "NO_CURSO": "name",
        "NO_IES": "institution",
        "TP_REDE_PADRONIZADA": "network",
        "TP_MODALIDADE_ENSINO": "modality",
        "TP_GRAU_ACADEMICO": "degree",
        "CO_MUNICIPIO": "municipality",
        "NO_CINE_AREA_GERAL": "area",
        "CO_CINE_AREA_GERAL": "area_code",
        "NU_ANO_REFERENCIA": "year",
        "QT_INGRESSANTE": "ingress",
        "QT_PERMANENCIA": "remaining",
        "DENOMINADOR_AJUSTADO": "denominator",
        "QT_DESISTENCIA": "annual_dropout",
        "QT_CONCLUINTE": "annual_concluded",
        "FALECIMENTOS_ACUMULADOS": "deaths",
        "TDA": "dropout_pct",
        "TCA": "concluded_pct",
        "TAP": "remaining_pct",
        "_AFTER_MAXIMUM_FOLLOWUP": "after_followup",
    }
    if (
        (
            data["QT_PERMANENCIA"]
            + data["concluded"]
            + data["dropout"]
            - data["DENOMINADOR_AJUSTADO"]
        ).abs()
        > 0.000001
    ).any():
        raise ValueError("Permanência, conclusão e desistência não fecham o denominador.")
    columns = list(mapping) + ["concluded", "dropout"]
    published = data.loc[data["QT_INGRESSANTE"].ge(10), columns].rename(columns=mapping)
    return published, {
        **checks,
        "suppressed_courses_under10": int(
            data.loc[data["NU_ANO_REFERENCIA"].eq(2024), "QT_INGRESSANTE"].lt(10).sum()
        ),
    }


def joined_product(final, source, kind):
    right = safe(source).dropna(subset=KEY).copy()
    unique(right, KEY + ["NU_ANO_REFERENCIA"])
    if kind == "cpc":
        right = right.sort_values("NU_ANO_REFERENCIA").drop_duplicates(KEY, keep="last")
        for column in COMPONENTS.values():
            right[column] = pd.to_numeric(right[column], errors="coerce")
        right["valid_measure"] = right["CPC_CONTINUO"].between(0, 5)
    else:
        right = right.loc[right["NU_ANO_REFERENCIA"].eq(2025)]
        right["valid_measure"] = right["QT_PARTICIPANTES"].gt(0) & right["QT_PROFICIENTE"].between(
            0, right["QT_PARTICIPANTES"]
        )
    unique(right, KEY)
    left = final.copy()
    if kind == "enade":
        left = left.loc[left["degree"].eq("2")]
    merged = left.merge(
        right,
        left_on=["ies", "course"],
        right_on=KEY,
        how="left",
        validate="one_to_one",
        indicator=True,
    )
    matched = merged["_merge"].eq("both")
    valid = (
        matched
        & merged["valid_measure"].astype("boolean").fillna(False)
        & merged["QT_PARTICIPANTES"].ge(10)
    )
    eligible = merged.loc[valid].copy()
    columns = list(final.columns)
    eligible["edition"] = eligible["NU_ANO_REFERENCIA"]
    eligible["participants"] = eligible["QT_PARTICIPANTES"]
    if kind == "cpc":
        eligible["cpc"] = eligible["CPC_CONTINUO"]
        eligible["components"] = eligible.apply(
            lambda row: {
                key: None if pd.isna(row[col]) else float(row[col])
                for key, col in COMPONENTS.items()
            },
            axis=1,
        )
        eligible["cpc_band"] = eligible["CPC_FAIXA"]
        extra = ["cpc", "cpc_band", "components"]
    else:
        eligible["proficient"] = eligible["QT_PROFICIENTE"]
        eligible["proficiency_pct"] = 100 * eligible["proficient"] / eligible["participants"]
        extra = ["proficient", "proficiency_pct"]
    return eligible[columns + ["edition", "participants"] + extra], {
        "universe_courses": len(left),
        "matched_courses": int(matched.sum()),
        "published_courses": len(eligible),
        "not_matched": int((~matched).sum()),
        "excluded_missing_or_small": int((matched & ~valid).sum()),
        "key": ["CO_IES", "CO_CURSO"],
        "cardinality": "one_to_one",
        "edition_policy": "latest_CPC_2021_2023" if kind == "cpc" else "Enade_2025",
    }


def census_products(frame, final):
    data = safe(frame)
    dimension = data["TP_MODALIDADE_ENSINO"].map({"1": "1", "2": "2"})
    data = data.loc[data["CO_UF"].eq("51") & data["TP_DIMENSAO"].eq(dimension)].copy()
    unique(data, ["NU_ANO_CENSO", "CO_IES", "CO_CURSO", "CO_MUNICIPIO", "TP_MODALIDADE_ENSINO"])
    money = ["QT_MAT", "QT_MAT_FIES", "QT_MAT_PROUNII", "QT_MAT_PROUNIP"]
    if data[money].isna().any().any():
        raise ValueError("Financiamento ausente: não imputar zero.")
    if (data[money[1:]].gt(data["QT_MAT"], axis=0)).any().any():
        raise ValueError("Beneficiários excedem matrículas no mesmo registro.")
    private = data.loc[data["TP_REDE_PADRONIZADA"].eq("2")]
    names = {
        "NU_ANO_CENSO": "year",
        "CO_IES": "ies",
        "CO_CURSO": "course",
        "TP_MODALIDADE_ENSINO": "modality",
        "TP_GRAU_ACADEMICO": "degree",
        "NO_CINE_AREA_GERAL": "area",
        "CO_MUNICIPIO": "municipality",
        "QT_MAT": "matriculated",
        "QT_MAT_FIES": "fies",
        "QT_MAT_PROUNII": "prouni_full",
        "QT_MAT_PROUNIP": "prouni_partial",
    }
    financial = (
        private.groupby(
            [
                "NU_ANO_CENSO",
                "TP_MODALIDADE_ENSINO",
                "TP_GRAU_ACADEMICO",
                "NO_CINE_AREA_GERAL",
                "CO_MUNICIPIO",
            ],
            dropna=False,
            as_index=False,
        )[money]
        .sum()
        .rename(columns=names)
    )
    financial["network"] = "2"
    # Relação entre cursos: financiamento 2024 versus trajetória da coorte 2015 em 2024.
    current = (
        private.loc[private["NU_ANO_CENSO"].eq(2024)]
        .groupby(["CO_IES", "CO_CURSO", "TP_MODALIDADE_ENSINO"], as_index=False)[money]
        .sum()
        .rename(columns=names)
    )
    linked = final.loc[final["network"].eq("2")].merge(
        current, on=["ies", "course", "modality"], how="inner", validate="one_to_one"
    )
    linked = linked.loc[linked["matriculated"].ge(10)].copy()
    linked["fies_pct"] = 100 * linked["fies"] / linked["matriculated"]
    linked["prouni_full_pct"] = 100 * linked["prouni_full"] / linked["matriculated"]
    linked["prouni_partial_pct"] = 100 * linked["prouni_partial"] / linked["matriculated"]
    offers = data.loc[data["NU_ANO_CENSO"].eq(2022) & data["TP_MODALIDADE_ENSINO"].eq("1")].copy()
    cols = ["QT_VG_TOTAL", "QT_MAT"]
    if offers[cols].isna().any().any():
        raise ValueError("Oferta ausente: não imputar zero.")
    municipal = (
        offers.groupby(["CO_MUNICIPIO", "NO_MUNICIPIO", "TP_REDE_PADRONIZADA"], as_index=False)[
            cols
        ]
        .sum()
        .rename(
            columns={
                "CO_MUNICIPIO": "municipality",
                "NO_MUNICIPIO": "name",
                "TP_REDE_PADRONIZADA": "network",
                "QT_VG_TOTAL": "vacancies",
                "QT_MAT": "matriculated",
            }
        )
    )
    return (
        financial,
        linked,
        municipal,
        {
            "financial_linked_courses": len(linked),
            "private_trajectory_courses": int(final["network"].eq("2").sum()),
            "municipal_population_available": False,
            "funding_overlap": "not_assumed_disjoint",
            "census_dimensions": {"1": "1", "2": "2"},
        },
    )


def build(frames):
    trajectories, trajectory_audit = trajectory(frames["trajetoria"])
    final = trajectories.loc[trajectories["year"].eq(2024)].copy()
    unique(final, ["ies", "course"])
    cpc, cpc_audit = joined_product(final, frames["cpc"], "cpc")
    enade, enade_audit = joined_product(final, frames["enade"], "enade")
    finance, linked, municipal, census_audit = census_products(frames["censo_cursos"], final)
    payload = {
        "trajectory": records(trajectories),
        "courses": records(final),
        "cpc": records(cpc),
        "enade": records(enade),
        "finance": records(finance),
        "funding_relationship": records(linked),
        "municipal": records(municipal),
    }
    audit = {
        "trajectory": trajectory_audit,
        "cpc": cpc_audit,
        "enade": enade_audit,
        "census": census_audit,
        "minimum_cell": 10,
        "publication": "diagnostico",
        "territory": "MT",
        "notes": [
            "Coorte 2015 presencial; outras coortes não estão disponíveis.",
            "CPC: última edição disponível por curso, entre 2021–2023; associação não prova causa.",
            "Enade 2025 e trajetória 2015–2024 são populações distintas; não formar um funil de pessoas.",
            "Financiamento 2024 não identifica beneficiários da coorte 2015.",
            "População municipal ausente; mapa mostra vagas, sem vagas por 100 jovens.",
            "Observações após limite de acompanhamento permanecem sinalizadas; taxas reconciliadas.",
        ],
    }
    return payload, audit


def publish():
    with connect() as connection:
        release = active(connection)
        census_keys = [
            "CO_UF",
            "NU_ANO_CENSO",
            "TP_MODALIDADE_ENSINO",
            "TP_DIMENSAO",
            "CO_IES",
            "CO_CURSO",
            "CO_MUNICIPIO",
            "NO_MUNICIPIO",
            "TP_REDE_PADRONIZADA",
            "TP_GRAU_ACADEMICO",
            "NO_CINE_AREA_GERAL",
            "QT_MAT",
            "QT_MAT_FIES",
            "QT_MAT_PROUNII",
            "QT_MAT_PROUNIP",
            "QT_VG_TOTAL",
            "_REQUIRES_REVIEW",
        ]
        # Nomes fixos do contrato, nunca entrada de usuário; reduz tráfego dos payloads.
        projection = ",".join(f"'{key}',payload->'{key}'" for key in census_keys)
        rows = connection.execute(
            "SELECT family,CASE WHEN family='censo_cursos' THEN jsonb_build_object("
            + projection
            + ") ELSE payload END payload FROM staging.record WHERE release_id=%s "
            "AND (family IN ('trajetoria','cpc','enade') OR (family='censo_cursos' "
            "AND ((modality='1' AND dimension='1') OR (modality='2' AND dimension='2'))))",
            (release,),
        ).fetchall()
        frames = {
            family: pd.DataFrame([row["payload"] for row in rows if row["family"] == family])
            for family in ("trajetoria", "cpc", "enade", "censo_cursos")
        }
        payload, audit = build(frames)
        from pipelines.municipal_population import attach_published

        has_population = attach_published(connection, release, payload, audit)
        contract = "dashboard-1.1.0" if has_population else CONTRACT
        connection.execute(
            "INSERT INTO analytics.dashboard_mt(release_id,contract_version,payload,audit) "
            "VALUES (%s,%s,%s,%s) ON CONFLICT(release_id) DO UPDATE SET "
            "contract_version=EXCLUDED.contract_version,payload=EXCLUDED.payload,audit=EXCLUDED.audit,created_at=now()",
            (release, contract, Jsonb(payload), Jsonb(audit)),
        )
    output = Path("outputs/dashboard")
    output.mkdir(parents=True, exist_ok=True)
    (output / "audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2))
    summary = {
        "release_id": str(release),
        "contract": contract,
        "records": {key: len(value) for key, value in payload.items()},
        "audit": audit,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return summary


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    try:
        publish()
    except Exception as error:
        print(
            json.dumps(
                {
                    "status": "failed",
                    "type": type(error).__name__,
                    "message": str(error)
                    if isinstance(error, ValueError)
                    else "Confira conexão e migrations.",
                }
            )
        )
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
