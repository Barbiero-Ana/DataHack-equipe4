import json
from datetime import datetime
from pathlib import Path

import pandas as pd
import pytest

from pipelines.extract import normalize_header, read_batches, sha256
from pipelines.review import join_coverage, trajectory_checks
from pipelines.run import process
from pipelines.transform import clean
from pipelines.validate import Profile


def test_identifiers_and_missing_are_not_zero() -> None:
    frame = pd.DataFrame(
        {"CO_CINE_AREA_GERAL": ["04", " 01 "], "CO_UF": ["0", "51"], "QT_MAT": ["", "0"]}
    )
    result, _, _ = clean(frame)
    assert result["CO_CINE_AREA_GERAL"].tolist() == ["04", "01"]
    assert pd.isna(result.loc[0, "CO_UF"])
    assert pd.isna(result.loc[0, "QT_MAT"])
    assert result.loc[1, "QT_MAT"] == 0


def test_invalid_numeric_is_flagged_and_original_preserved() -> None:
    result, _, _ = clean(pd.DataFrame({"QT_MAT": ["wrong", "3"]}))
    profile = Profile()
    invalid = profile.update(result, "documentacao")
    assert invalid.tolist() == [True, False]
    assert profile.errors["parse:QT_MAT"] == 1
    assert result.loc[0, "_ORIGINAL_QT_MAT"] == "wrong"


def test_locale_numeric_and_quality_markers() -> None:
    result, _, _ = clean(
        pd.DataFrame({"CPC (Contínuo)": ["3,4", "SC"], "CPC (Faixa)": ["4", "SC"]})
    )
    assert result.loc[0, "CPC_CONTINUO"] == 3.4
    assert pd.isna(result.loc[1, "CPC_CONTINUO"])
    assert result.loc[1, "CPC_FAIXA"] == "SC"
    assert result.loc[1, "_ORIGINAL_CPC_CONTINUO"] == "SC"


def test_header_collision_is_rejected() -> None:
    with pytest.raises(ValueError, match="Colisão"):
        clean(pd.DataFrame([[1, 2]], columns=["Código do Curso", "CO_CURSO"]))
    assert normalize_header("  Sigla da UF** ") == "SIGLA_DA_UF"


def test_network_enum_is_not_administrative_enum() -> None:
    data, _, _ = clean(pd.DataFrame({
        "TP_REDE": ["1", "2", "1"],
        "TP_CATEGORIA_ADMINISTRATIVA": ["2.0", "4", "4"],
        "TP_MODALIDADE_ENSINO": ["1.0", "2", "1"],
    }))
    assert data["DS_REDE"].tolist() == ["publica", "privada", "publica"]
    assert data["TP_CATEGORIA_ADMINISTRATIVA"].tolist() == ["2", "4", "4"]
    assert data["TP_MODALIDADE_ENSINO"].tolist() == ["1", "2", "1"]
    assert Profile().update(data, "documentacao").tolist() == [False, False, True]
    fallback, _, _ = clean(pd.DataFrame({"TP_CATEGORIA_ADMINISTRATIVA": ["2", "5", "7"]}))
    assert fallback.loc[0, "DS_REDE"] == "publica"
    assert fallback.loc[1, "DS_REDE"] == "privada"
    assert fallback.loc[2, "REDE_PENDENTE"]


def test_population_missing_band_is_not_zero() -> None:
    data, _, _ = clean(pd.DataFrame({"18_19_ANOS": ["108126", ""],
                                   "20_24_ANOS": ["289545", "10"]}))
    assert data.loc[0, "QT_POP_18_24"] == 397671
    assert pd.isna(data.loc[1, "QT_POP_18_24"])


def test_null_join_key_is_not_a_match() -> None:
    result = join_coverage(pd.DataFrame({"CO_CURSO": ["1", None]}),
                           pd.DataFrame({"CO_CURSO": ["2", None]}), ["CO_CURSO"])
    assert result["matched"] == 0
    assert result["left_rows_with_null_key"] == 1


def test_xlsx_footnotes_and_summary_are_logged(tmp_path: Path) -> None:
    from openpyxl import Workbook

    book = Workbook()
    sheet = book.active
    sheet.append(["Ano", "Código do Curso", "CPC (Contínuo)"])
    sheet.append([2022, 123, "3,4"])
    sheet.append(["¹ Nota sobre a fonte", None, None])
    sheet.append([None, None, 1])
    book.create_sheet("Atualizações").append([datetime(2026, 10, 10), "Correção"])
    path = tmp_path / "cpc_2022.xlsx"
    book.save(path)
    frames = list(read_batches(path, "cpc", 10))
    assert len(frames[0][0]) == 1
    assert len(frames[0][0].attrs["excluded_notes"]) == 2
    assert frames[0][0].attrs["source_rows"] == [2]
    metadata = frames[0][0].attrs["source_metadata"]
    assert "2026-10-10T00:00:00" in json.dumps(metadata)


def test_course_has_distinct_geographic_dimensions() -> None:
    source = pd.DataFrame(
        {
            "NU_ANO_CENSO": ["2024"] * 3,
            "CO_IES": ["1"] * 3,
            "CO_CURSO": ["123"] * 3,
            "CO_REGIAO": ["5"] * 3,
            "CO_UF": ["51"] * 3,
            "CO_MUNICIPIO": ["", "5103403", "5103403"],
            "TP_DIMENSAO": ["5", "6", "6"],
            "QT_MAT": ["100", "100", "100"],
            "QT_ING": ["10"] * 3,
            "QT_VG_TOTAL": ["20"] * 3,
            "QT_SIT_DESVINCULADO": ["0"] * 3,
        }
    )
    frame, _, _ = clean(source)
    profile = Profile()
    profile.update(frame.iloc[:2], "censo_cursos")
    profile.update(frame.iloc[2:], "censo_cursos")
    assert profile.as_dict()["duplicate_key_rows"] == 2
    assert profile.as_dict()["duplicate_key_groups"] == 1


def test_enade_proficiency_uses_proportion() -> None:
    source = pd.DataFrame(
        {
            "CO_CURSO": ["26"],
            "NU_ANO_REFERENCIA": ["2025"],
            "QT_PARTICIPANTES": ["11"],
            "QT_PROFICIENTE": ["8"],
            "PROFICIENCIA_PROPORCAO": ["0.727"],
        }
    )
    frame, _, _ = clean(source)
    profile = Profile()
    assert not profile.update(frame, "enade").any()
    frame["PROFICIENCIA_PROPORCAO"] = 72.7
    assert Profile().update(frame, "enade").all()


def test_annual_counts_cumulative_rates_and_deaths() -> None:
    source = pd.DataFrame(
        {
            "CO_CURSO": ["1", "1"],
            "CO_IES": ["1", "1"],
            "NU_ANO_INGRESSO": [2015, 2015],
            "NU_ANO_REFERENCIA": [2015, 2016],
            "NU_ANO_MAXIMO_ACOMPANHAMENTO": [2015, 2015],
            "QT_INGRESSANTE": [100, 100],
            "QT_FALECIDO": [0, 1],
            "QT_CONCLUINTE": [1, 1],
            "QT_DESISTENCIA": [0, 2],
            "QT_PERMANENCIA": [99, 95],
            "TAP": [99, 95 / 99 * 100],
            "TCA": [1, 2 / 99 * 100],
            "TDA": [0, 2 / 99 * 100],
            "TCAN": [1, 1 / 99 * 100],
            "TADA": [0, 2 / 99 * 100],
            "TP_MODALIDADE_ENSINO": ["1", "1"],
        }
    )
    checks, result = trajectory_checks(source)
    assert result["DENOMINADOR_AJUSTADO"].tolist() == [100, 99]
    assert checks["TCA_count_formula_mismatch"] == 0
    assert checks["TDA_count_formula_mismatch"] == 0


def test_join_reports_many_to_many_risk() -> None:
    left = pd.DataFrame({"CO_CURSO": ["1", "2"]})
    right = pd.DataFrame({"CO_CURSO": ["1", "1"]})
    result = join_coverage(left, right, ["CO_CURSO"])
    assert result["coverage_pct"] == 50
    assert result["right_duplicate_rows"] == 2


def test_chunked_run_is_reproducible_and_preserves_source(tmp_path: Path) -> None:
    source = tmp_path / "censo_ies.csv"
    source.write_bytes(b"NU_ANO_CENSO;CO_IES;CO_UF_IES;NO_IES\n2024;1;51;Institui\xe7\xe3o\n")
    before = sha256(source)
    batches = list(read_batches(source, "censo_ies", 1))
    assert len(batches) == 1
    assert batches[0][0].loc[0, "NO_IES"] == "Instituição"
    output = tmp_path / "output"
    first = process(source, output, 1)
    second = process(source, output, 20)
    assert first["sha256"] == second["sha256"] == before == sha256(source)
    assert first["rows"] == second["rows"] == 1
    saved = pd.read_parquet(output / first["staging"])
    assert saved.loc[0, "CO_IES"] == "1"
    assert saved.loc[0, "_SOURCE_ROW"] == 2
