from pydantic import BaseModel


class GPUInfo(BaseModel):
    name: str | None
    total_vram_gb: float | None
    free_vram_gb: float | None
    utilization_percent: float | None


class CPUInfo(BaseModel):
    model: str | None
    cores_physical: int | None
    cores_logical: int | None
    instruction_sets: list[str]


class MemoryInfo(BaseModel):
    total_gb: float | None
    available_gb: float | None


class HardwareProfile(BaseModel):
    gpu: GPUInfo | None
    cpu: CPUInfo
    memory: MemoryInfo
    os: str
