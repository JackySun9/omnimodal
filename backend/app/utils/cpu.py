from __future__ import annotations

import platform

try:
    import cpuinfo  # type: ignore
except ImportError:  # pragma: no cover
    cpuinfo = None  # type: ignore


class CPUFeatureDetector:
    @staticmethod
    def supported_instruction_sets() -> list[str]:
        flags: list[str] = []
        if cpuinfo is not None:
            info = cpuinfo.get_cpu_info()  # type: ignore[attr-defined]
            flags = [flag.upper() for flag in info.get("flags", [])]
        else:
            # Fallback heuristic using platform module; limited coverage
            processor = platform.processor().lower()
            if "avx2" in processor:
                flags.append("AVX2")
        return flags
