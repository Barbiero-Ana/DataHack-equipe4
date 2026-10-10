import pytest


@pytest.fixture(autouse=True)
def isolate_database_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    # Testes unitários nunca herdam uma conexão real do processo.
    monkeypatch.delenv("DATABASE_URL", raising=False)
