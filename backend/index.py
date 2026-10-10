"""Ponto de entrada ASGI para a Vercel (serviço "backend" no vercel.json da raiz).

A aplicação usa uma factory; a Vercel precisa de uma variável de módulo. Localmente e no
Railway continua valendo `uvicorn app.main:create_app --factory` (start.sh).
"""
from app.main import create_app

app = create_app()
