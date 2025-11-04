from __future__ import annotations

from typing import Dict, Type

from app.executors.base import BaseExecutor


class ExecutorRegistry:
    def __init__(self) -> None:
        self._executors: Dict[str, Type[BaseExecutor]] = {}

    def register(self, name: str, executor_cls: Type[BaseExecutor]) -> None:
        self._executors[name] = executor_cls

    def get(self, name: str) -> Type[BaseExecutor] | None:
        return self._executors.get(name)

    def all(self) -> dict[str, Type[BaseExecutor]]:
        return dict(self._executors)


registry = ExecutorRegistry()


def register_builtin_executors() -> None:
    from app.executors.audio.stt_whispercpp import WhisperCppSTTExecutor
    from app.executors.audio.stt_whisper import WhisperSTTExecutor
    from app.executors.audio.stt_faster_whisper import FasterWhisperSTTExecutor
    from app.executors.audio.tts_piper import PiperTTSExecutor
    from app.executors.image.ollama_diffuser import OllamaDiffuserExecutor
    from app.executors.text.ollama import OllamaExecutor
    from app.executors.video.svd import StableVideoDiffusionExecutor

    registry.register(OllamaExecutor.name, OllamaExecutor)
    registry.register(OllamaDiffuserExecutor.name, OllamaDiffuserExecutor)
    registry.register(WhisperCppSTTExecutor.name, WhisperCppSTTExecutor)
    registry.register(WhisperSTTExecutor.name, WhisperSTTExecutor)
    registry.register(FasterWhisperSTTExecutor.name, FasterWhisperSTTExecutor)
    registry.register(PiperTTSExecutor.name, PiperTTSExecutor)
    registry.register(StableVideoDiffusionExecutor.name, StableVideoDiffusionExecutor)
