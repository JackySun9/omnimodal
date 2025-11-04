from fastapi import APIRouter

from app.api.v1 import hardware, models, executors, stt

api_router = APIRouter()
api_router.include_router(hardware.router, prefix="/hardware", tags=["hardware"])
api_router.include_router(models.router, prefix="/models", tags=["models"])
api_router.include_router(executors.router, prefix="/executors", tags=["executors"])
api_router.include_router(stt.router, prefix="/stt", tags=["speech-to-text"])
