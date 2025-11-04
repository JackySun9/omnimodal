import platform

import psutil

from app.schemas.hardware import CPUInfo, GPUInfo, HardwareProfile, MemoryInfo
from app.utils.cpu import CPUFeatureDetector
from app.utils.gpu import GPUDetector


class HardwareService:
    def __init__(self) -> None:
        self._gpu_detector = GPUDetector()

    async def get_profile(self) -> HardwareProfile:
        gpu_info = await self._gpu_detector.detect()
        cpu_info = self._get_cpu_info()
        memory_info = self._get_memory_info()
        return HardwareProfile(
            gpu=gpu_info,
            cpu=cpu_info,
            memory=memory_info,
            os=platform.platform(),
        )

    def _get_cpu_info(self) -> CPUInfo:
        return CPUInfo(
            model=platform.processor() or None,
            cores_physical=psutil.cpu_count(logical=False),
            cores_logical=psutil.cpu_count(logical=True),
            instruction_sets=CPUFeatureDetector.supported_instruction_sets(),
        )

    def _get_memory_info(self) -> MemoryInfo:
        virtual_mem = psutil.virtual_memory()
        return MemoryInfo(
            total_gb=round(virtual_mem.total / (1024**3), 2),
            available_gb=round(virtual_mem.available / (1024**3), 2),
        )
