from pathlib import Path
from typing import Literal

from pydantic import AnyHttpUrl, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="forbid",
        hide_input_in_errors=True,
    )

    app_name: str = Field(default="Rota do Diploma", min_length=1)
    environment: Literal["development", "test", "production"] = "development"
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[AnyHttpUrl] = Field(default_factory=list)
    database_url: SecretStr | None = None
    db_pool_size: int = Field(default=3, ge=1, le=20)
    db_max_overflow: int = Field(default=2, ge=0, le=20)
    db_pool_timeout: int = Field(default=5, ge=1, le=60)
    db_pool_recycle: int = Field(default=1800, ge=60)
    db_connect_timeout: int = Field(default=5, ge=2, le=60)
    db_statement_timeout_ms: int = Field(default=3000, ge=100, le=60000)

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: SecretStr | None) -> SecretStr | None:
        if value is None:
            return None
        try:
            url = make_url(value.get_secret_value())
            valid = (
                url.drivername in ("postgresql", "postgresql+psycopg")
                and bool(url.host and url.database and url.username)
                and (url.port is None or 1 <= url.port <= 65535)
            )
        except (ArgumentError, ValueError):
            valid = False
        if not valid:
            raise ValueError("DATABASE_URL deve ser uma URL PostgreSQL válida.") from None
        return value

    @model_validator(mode="after")
    def require_production_database(self) -> "Settings":
        if self.environment == "production" and self.database_url is None:
            raise ValueError("DATABASE_URL é obrigatória em produção.")
        return self

    @field_validator("api_v1_prefix")
    @classmethod
    def validate_prefix(cls, value: str) -> str:
        if not value.startswith("/") or value.endswith("/") or "//" in value:
            raise ValueError("O prefixo deve começar com / e não terminar com /.")
        if any(character in value for character in " ?#"):
            raise ValueError("O prefixo deve conter somente um caminho HTTP.")
        return value

    @field_validator("cors_origins")
    @classmethod
    def validate_origins(cls, values: list[AnyHttpUrl]) -> list[AnyHttpUrl]:
        for value in values:
            if value.username or value.password or value.query or value.fragment:
                raise ValueError("Origens CORS não podem conter credenciais, query ou fragmento.")
            if value.path not in (None, "/"):
                raise ValueError("Origens CORS não podem conter caminhos.")
        return values
