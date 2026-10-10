import json

import pandas as pd
import pytest
from pipelines.municipal_population import AGES, read_source


@pytest.fixture
def input_files(tmp_path, monkeypatch):
    names = [f"Município {i}" for i in range(141)]
    rows = [[None, None, *AGES], ["Mato Grosso", "Total", 141, 282, 423]]
    rows += [[n + " (MT)", "Total", 1, 2, 3] for n in names]
    frame = pd.DataFrame(rows)
    reference = [
        {
            "resultados": [
                {
                    "classificacoes": [
                        {"nome": "Sexo", "categoria": {"1": "Total"}},
                        {"nome": "Forma de declaração da idade", "categoria": {"1": "Total"}},
                        {"nome": "Idade", "categoria": {"1": age}},
                    ],
                    "series": [
                        {
                            "localidade": {
                                "id": f"51{i:05d}",
                                "nome": n + " - MT",
                                "nivel": {"id": "N6"},
                            },
                            "serie": {"2022": str(value)},
                        }
                        for i, n in enumerate(names)
                    ],
                }
                for value, age in enumerate(AGES, 1)
            ]
        }
    ]
    source = tmp_path / "source.xlsx"
    source.write_bytes(b"source fixture")
    ref = tmp_path / "reference.json"
    ref.write_text(json.dumps(reference))
    monkeypatch.setattr(pd, "read_excel", lambda *a, **k: frame.copy())
    return source, ref, frame


def test_matches_each_age_and_state_without_double_counting(input_files):
    source, ref, _ = input_files
    raw, rows, audit = read_source(source, ref)
    assert len(raw) == len(rows) == 141
    assert audit["age_values_compared"] == 423
    assert audit["population"] == 846
    assert all(r["population"] == 6 for r in rows)


def test_incorrect_age_value_blocks_publication(input_files):
    source, ref, frame = input_files
    frame.iloc[2, 2] = 99
    with pytest.raises(ValueError, match="diverge"):
        read_source(source, ref)


def test_suppression_is_not_zero(input_files):
    source, ref, frame = input_files
    frame.iloc[2, 2] = "X"
    with pytest.raises(ValueError, match="suprimida"):
        read_source(source, ref)


def test_duplicate_municipality_blocks_join(input_files):
    source, ref, frame = input_files
    frame.iloc[3, 0] = frame.iloc[2, 0]
    with pytest.raises(ValueError, match="duplicado"):
        read_source(source, ref)
