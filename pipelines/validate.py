"""Validações independentes das métricas de negócio."""

from collections import Counter
from dataclasses import dataclass, field

import pandas as pd

from pipelines.transform import RATES, numeric_column


@dataclass
class Profile:
    rows: int = 0
    missing: Counter = field(default_factory=Counter)
    categories: dict[str, Counter] = field(default_factory=dict)
    errors: Counter = field(default_factory=Counter)
    keys: Counter = field(default_factory=Counter)
    changed: Counter = field(default_factory=Counter)
    dimensions: dict[str, Counter] = field(default_factory=dict)
    mappings: dict[str, str] = field(default_factory=dict)

    def update(self, frame: pd.DataFrame, kind: str) -> pd.Series:
        self.rows += len(frame)
        invalid_row = pd.Series(False, index=frame.index)
        if "_NETWORK_CONFLICT" in frame:
            conflict = frame["_NETWORK_CONFLICT"]
            if conflict.any():
                self.errors["network_category_conflict"] += int(conflict.sum())
                invalid_row |= conflict
        for column in frame:
            if column.startswith("_"):
                if column.startswith("_INVALID_"):
                    count = int(frame[column].sum())
                    if count:
                        self.errors[f"parse:{column[9:]}"] += count
                        invalid_row |= frame[column]
                continue
            self.missing[column] += int(frame[column].isna().sum())
            if column.startswith(("TP_", "SG_UF")) or column in {
                "CPC_FAIXA",
                "ENADE_FAIXA",
                "NU_ANO_REFERENCIA",
                "NU_ANO_INGRESSO",
            }:
                counts = frame[column].astype("string").fillna("<NULL>").value_counts().to_dict()
                self.categories.setdefault(column, Counter()).update(counts)
            if numeric_column(column):
                values = frame[column]
                if column.startswith("QT_"):
                    bad = ((values < 0) | (values % 1 != 0)).fillna(False)
                elif column in RATES:
                    bad = ((values < 0) | (values > 100)).fillna(False)
                elif column == "PROFICIENCIA_PROPORCAO":
                    bad = ((values < 0) | (values > 1)).fillna(False)
                elif column == "CPC_CONTINUO":
                    bad = ((values < 0) | (values > 5)).fillna(False)
                else:
                    continue
                if bad.any():
                    self.errors[f"range:{column}"] += int(bad.sum())
                    invalid_row |= bad
        required = {
            "censo_cursos": ["NU_ANO_CENSO", "TP_DIMENSAO", "CO_IES", "CO_CURSO"],
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
        absent = set(required) - set(frame)
        if absent:
            raise ValueError(f"Colunas obrigatórias ausentes: {sorted(absent)}")
        if required:
            missing_key = frame[required].isna().any(axis=1)
            if missing_key.any():
                self.errors["missing_key"] += int(missing_key.sum())
                invalid_row |= missing_key
            key = required + (
                ["CO_REGIAO", "CO_UF", "CO_MUNICIPIO"] if kind == "censo_cursos" else []
            )
            hashes = pd.util.hash_pandas_object(frame[key].astype("string"), index=False)
            self.keys.update(hashes.tolist())
        if kind == "trajetoria":
            bad = frame["NU_ANO_REFERENCIA"].lt(frame["NU_ANO_INGRESSO"]).fillna(False)
            self.errors["reference_before_cohort"] += int(bad.sum())
            invalid_row |= bad
            # Taxas são percentuais; a tolerância contempla arredondamento.
            complete = frame[["TAP", "TCA", "TDA"]].notna().all(axis=1)
            bad = complete & frame[["TAP", "TCA", "TDA"]].sum(axis=1).sub(100).abs().gt(0.05)
            self.errors["trajectory_rates_not_100"] += int(bad.sum())
            invalid_row |= bad
        if kind == "enade":
            if {"QT_PROFICIENTE", "QT_PARTICIPANTES"} <= set(frame):
                bad = frame["QT_PROFICIENTE"].gt(frame["QT_PARTICIPANTES"]).fillna(False)
                self.errors["proficient_above_participants"] += int(bad.sum())
                invalid_row |= bad
                denominator = frame["QT_PARTICIPANTES"].where(frame["QT_PARTICIPANTES"] > 0)
                computed = frame["QT_PROFICIENTE"] / denominator
                bad = (computed - frame["PROFICIENCIA_PROPORCAO"]).abs().gt(0.0011).fillna(False)
                self.errors["proficiency_count_ratio_mismatch"] += int(bad.sum())
                invalid_row |= bad
        if kind == "censo_cursos":
            for label, group in frame.groupby("TP_DIMENSAO", dropna=False):
                totals = {
                    "rows": len(group),
                    "mt_rows": int(group["CO_UF"].eq("51").sum()),
                }
                for column in [
                    "QT_MAT",
                    "QT_ING",
                    "QT_VG_TOTAL",
                    "QT_SIT_DESVINCULADO",
                ]:
                    totals[column] = float(group[column].sum())
                self.dimensions.setdefault(str(label), Counter()).update(totals)
        return invalid_row

    def as_dict(self) -> dict:
        return {
            "rows": self.rows,
            "missing": dict(self.missing),
            "categories": {key: dict(value) for key, value in self.categories.items()},
            "errors": {key: value for key, value in self.errors.items() if value},
            "duplicate_key_rows": sum(value for value in self.keys.values() if value > 1),
            "duplicate_key_groups": sum(value > 1 for value in self.keys.values()),
            "changed_cells": dict(self.changed),
            "dimensions": {key: dict(value) for key, value in self.dimensions.items()},
            "column_mapping": self.mappings,
        }
