from fastapi import APIRouter

from app.api.v1.endpoints.health import router as health_router

health_router_root = APIRouter()
health_router_root.include_router(health_router)

# Os endpoints de domínio futuros serão registrados neste router versionado.
api_v1_router = APIRouter()
