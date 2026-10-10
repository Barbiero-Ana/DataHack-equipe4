import pandas as pd
import pytest

from pipelines.dashboard import joined_product, trajectory


def sample():
    rows = []
    for year in (2015, 2016):
        rows.append(
            {
                "CO_IES": "1",
                "CO_CURSO": "100",
                "NO_CURSO": "Curso real",
                "NO_IES": "IES",
                "TP_REDE_PADRONIZADA": "1",
                "TP_MODALIDADE_ENSINO": "1",
                "TP_GRAU_ACADEMICO": "2",
                "CO_MUNICIPIO": "5103403",
                "NO_CINE_AREA_GERAL": "Educação",
                "CO_CINE_AREA_GERAL": "01",
                "NU_ANO_INGRESSO": 2015,
                "NU_ANO_REFERENCIA": year,
                "NU_ANO_MAXIMO_ACOMPANHAMENTO": 2024,
                "QT_INGRESSANTE": 100,
                "QT_PERMANENCIA": 90 if year == 2015 else 80,
                "QT_CONCLUINTE": 5,
                "QT_DESISTENCIA": 5,
                "QT_FALECIDO": 0,
                "TDA": 5 if year == 2015 else 10,
                "TCA": 5 if year == 2015 else 10,
                "TAP": 90 if year == 2015 else 80,
                "TCAN": 5,
                "TADA": 5,
                "_REQUIRES_REVIEW": False,
            }
        )
    return pd.DataFrame(rows)


def test_counts_accumulate_once_and_reconcile():
    result, audit = trajectory(sample())
    assert result.iloc[-1]["dropout"] == 10
    assert result.iloc[-1]["denominator"] == 100
    assert result["ingress"].eq(100).all()
    assert audit["TDA_count_formula_mismatch"] == 0


def test_reconciliation_blocks_wrong_rate():
    frame = sample()
    frame.loc[1, "TDA"] = 20
    with pytest.raises(ValueError, match="reconciliação"):
        trajectory(frame)


def test_duplicate_key_blocks_publication():
    frame = sample()
    with pytest.raises(ValueError, match="duplicada"):
        trajectory(pd.concat([frame, frame.iloc[:1]]))


def test_small_cohort_is_suppressed():
    frame = sample()
    frame["QT_INGRESSANTE"] = 5
    frame["QT_PERMANENCIA"] = [3, 1]
    frame["QT_CONCLUINTE"] = 1
    frame["QT_DESISTENCIA"] = 1
    frame["TAP"] = [60, 20]
    frame["TCA"] = [20, 40]
    frame["TDA"] = [20, 40]
    frame["TCAN"] = 20
    frame["TADA"] = 20
    result, _ = trajectory(frame)
    assert result.empty


def test_enade_join_never_multiplies_people_between_populations():
    final = trajectory(sample())[0].iloc[-1:].copy()
    source = pd.DataFrame(
        [
            {
                "CO_IES": "1",
                "CO_CURSO": "100",
                "NU_ANO_REFERENCIA": 2025,
                "QT_PARTICIPANTES": 20,
                "QT_PROFICIENTE": 15,
            }
        ]
    )
    result, audit = joined_product(final, source, "enade")
    assert result.iloc[0]["proficiency_pct"] == 75
    assert result.iloc[0]["participants"] == 20
    assert result.iloc[0]["ingress"] == 100
    assert audit["published_courses"] == 1


def test_enade_small_participant_count_is_excluded():
    final = trajectory(sample())[0].iloc[-1:].copy()
    source = pd.DataFrame(
        [
            {
                "CO_IES": "1",
                "CO_CURSO": "100",
                "NU_ANO_REFERENCIA": 2025,
                "QT_PARTICIPANTES": 5,
                "QT_PROFICIENTE": 4,
            }
        ]
    )
    result, audit = joined_product(final, source, "enade")
    assert result.empty
    assert audit["excluded_missing_or_small"] == 1
