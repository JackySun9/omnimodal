from __future__ import annotations

import subprocess
from typing import Optional

try:
    import pynvml  # type: ignore
except ImportError:  # pragma: no cover
    pynvml = None  # type: ignore

try:  # pragma: no cover
    import GPUtil
except ImportError:  # pragma: no cover
    GPUtil = None  # type: ignore

from app.schemas.hardware import GPUInfo


class GPUDetector:
    async def detect(self) -> Optional[GPUInfo]:
        # Try Apple Silicon first (most common on Mac)
        detector = self._detect_apple_silicon()
        if detector:
            return detector
        
        # Try NVIDIA
        detector = self._detect_via_nvml()
        if detector:
            return detector
        
        # Try GPUtil (AMD/fallback)
        detector = self._detect_via_gputil()
        if detector:
            return detector
        
        return None

    def _detect_apple_silicon(self) -> Optional[GPUInfo]:
        """Detect Apple Silicon (M1/M2/M3) GPU."""
        try:
            # Check if running on macOS
            result = subprocess.run(
                ["system_profiler", "SPDisplaysDataType"],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode != 0:
                return None
            
            output = result.stdout
            
            # Look for Apple GPU
            if "Apple" not in output or "Metal" not in output:
                return None
            
            # Extract chipset model
            gpu_name = None
            for line in output.split('\n'):
                if 'Chipset Model:' in line:
                    gpu_name = line.split('Chipset Model:')[1].strip()
                    break
            
            if not gpu_name:
                return None
            
            # Get unified memory info (Apple Silicon uses unified memory)
            mem_result = subprocess.run(
                ["sysctl", "hw.memsize"],
                capture_output=True,
                text=True,
                timeout=2
            )
            
            total_mem_bytes = 0
            if mem_result.returncode == 0:
                # Parse: hw.memsize: 68719476736
                mem_str = mem_result.stdout.split(':')[1].strip()
                total_mem_bytes = int(mem_str)
            
            total_mem_gb = total_mem_bytes / (1024**3)
            
            # For Apple Silicon, "free" VRAM is harder to determine
            # We'll estimate it as a portion of total memory
            # Typically, macOS allocates dynamically, so we'll use 50% as available
            free_mem_gb = total_mem_gb * 0.5
            
            return GPUInfo(
                name=gpu_name,
                total_vram_gb=round(total_mem_gb, 2),
                free_vram_gb=round(free_mem_gb, 2),
                utilization_percent=None,  # Not easily available on macOS
            )
            
        except Exception:  # pragma: no cover
            return None

    def _detect_via_nvml(self) -> Optional[GPUInfo]:
        if pynvml is None:
            return None
        try:
            pynvml.nvmlInit()
            device = pynvml.nvmlDeviceGetHandleByIndex(0)
            name = pynvml.nvmlDeviceGetName(device)
            if isinstance(name, bytes):
                name = name.decode("utf-8")
            mem_info = pynvml.nvmlDeviceGetMemoryInfo(device)
            utilization = pynvml.nvmlDeviceGetUtilizationRates(device)
            return GPUInfo(
                name=name,
                total_vram_gb=round(mem_info.total / (1024**3), 2),
                free_vram_gb=round(mem_info.free / (1024**3), 2),
                utilization_percent=float(utilization.gpu),
            )
        except Exception:  # pragma: no cover
            return None
        finally:
            try:
                pynvml.nvmlShutdown()
            except Exception:  # pragma: no cover
                pass

    def _detect_via_gputil(self) -> Optional[GPUInfo]:
        if GPUtil is None:
            return None
        try:
            gpus = GPUtil.getGPUs()
            if not gpus:
                return None
            gpu = gpus[0]
            return GPUInfo(
                name=gpu.name,
                total_vram_gb=round(gpu.memoryTotal / 1024, 2),
                free_vram_gb=round(gpu.memoryFree / 1024, 2),
                utilization_percent=round(gpu.load * 100, 2),
            )
        except Exception:  # pragma: no cover
            return None
