from fastapi import APIRouter

from app.schemas.hardware import HardwareProfile
from app.services.hardware import HardwareService

router = APIRouter()


@router.get("", response_model=HardwareProfile)
async def get_hardware_profile() -> HardwareProfile:
    service = HardwareService()
    return await service.get_profile()
