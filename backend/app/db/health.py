from sqlalchemy import text
from sqlalchemy.orm import Session


def check_database(session: Session) -> None:
    if session.execute(text("SELECT 1")).scalar_one() != 1:
        raise RuntimeError("Resposta inesperada do banco.")
