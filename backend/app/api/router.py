from fastapi import APIRouter

from app.api.v1.endpoints.analytics import router as analytics_router
from app.api.v1.endpoints.health import router as health_router

health_router_root = APIRouter()
health_router_root.include_router(health_router)

api_v1_router = APIRouter()
api_v1_router.include_router(analytics_router)
