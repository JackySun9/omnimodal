from __future__ import annotations

from typing import Any

import anyio
from huggingface_hub import HfApi

from app.core.config import settings
from app.schemas.hardware import HardwareProfile
from app.schemas.models import DiscoveredModel, ModelSearchFilters
from app.services.hardware import HardwareService
from app.services.recommendation import RecommendationEngine


class ModelDiscoveryService:
    def __init__(self, *, token: str | None = None) -> None:
        api_token = token if token is not None else settings.HUGGINGFACE_TOKEN
        self._api = HfApi(token=api_token)

    async def search(self, filters: ModelSearchFilters) -> list[DiscoveredModel]:
        def _list_models() -> list[Any]:
            return list(
                self._api.list_models(
                    search=filters.query,
                    filter=filters.task,
                    limit=filters.limit,
                    sort="downloads",
                    direction=-1,
                )
            )

        results = await anyio.to_thread.run_sync(_list_models)
        
        # Get hardware profile if compatibility scoring is requested
        hardware_profile: HardwareProfile | None = None
        recommendation_engine: RecommendationEngine | None = None
        if filters.include_compatibility:
            hardware_service = HardwareService()
            hardware_profile = await hardware_service.get_profile()
            recommendation_engine = RecommendationEngine(hardware_profile)
        
        items: list[DiscoveredModel] = []
        for model_info in results:
            # Parse model metadata
            model = DiscoveredModel(
                repo_id=model_info.modelId,
                name=model_info.cardData.get("pretty_name") if model_info.cardData else None,
                task=(model_info.pipeline_tag or None),
                likes=model_info.likes,
                tags=list(model_info.tags or []),
                siblings=[s.rfilename for s in model_info.siblings or []],
                card_data=self._extract_enhanced_metadata(model_info),
                downloads=model_info.downloads,
            )
            
            # Add hardware compatibility scoring
            if recommendation_engine:
                compatibility = recommendation_engine.evaluate_model(model)
                model.compatibility = {
                    "status": compatibility.status,
                    "score": compatibility.score,
                    "reason": compatibility.reason,
                }
            
            items.append(model)
        
        # Sort by compatibility score if available
        if filters.include_compatibility:
            items.sort(key=lambda x: x.compatibility.get("score", 0) if x.compatibility else 0, reverse=True)
        
        return items

    def _extract_enhanced_metadata(self, model_info: Any) -> dict[str, object]:
        """Extract enhanced metadata for multimodal models."""
        metadata: dict[str, object] = {}
        
        if model_info.cardData:
            metadata.update(model_info.cardData)
        
        # Extract model-specific attributes
        tags = list(model_info.tags or [])
        tags_str = " ".join(tags).lower()
        
        # LLM/Text metadata
        if any(x in tags_str for x in ["text-generation", "llm", "language-model"]):
            metadata["parameter_count"] = self._extract_parameter_count(model_info.modelId, tags_str)
            metadata["quantization"] = self._extract_quantization_info(tags_str)
            metadata["context_length"] = self._extract_context_length(model_info.cardData or {})
        
        # Image generation metadata
        if any(x in tags_str for x in ["text-to-image", "stable-diffusion", "diffusion"]):
            metadata["model_type"] = self._extract_image_model_type(tags_str)
            metadata["supports_controlnet"] = "controlnet" in tags_str
            metadata["supports_lora"] = "lora" in tags_str
        
        # STT metadata
        if "whisper" in tags_str or "speech-recognition" in tags_str:
            metadata["model_size"] = self._extract_whisper_size(model_info.modelId, tags_str)
            metadata["languages"] = self._extract_languages(model_info.cardData or {})
        
        # TTS metadata
        if "text-to-speech" in tags_str or "tts" in tags_str:
            metadata["languages"] = self._extract_languages(model_info.cardData or {})
            metadata["num_speakers"] = self._extract_num_speakers(model_info.cardData or {})
        
        # Video metadata
        if "video" in tags_str:
            metadata["recommended_fps"] = self._extract_fps(model_info.cardData or {})
        
        return metadata

    def _extract_parameter_count(self, model_id: str, tags_str: str) -> str | None:
        """Extract parameter count (e.g., 7B, 13B)."""
        import re
        # Look for patterns like "7b", "13b", "70b"
        match = re.search(r"(\d+)b", tags_str + " " + model_id.lower())
        if match:
            return f"{match.group(1)}B"
        return None

    def _extract_quantization_info(self, tags_str: str) -> str | None:
        """Extract quantization level."""
        quant_types = ["Q4_K_M", "Q4_0", "Q5_K_M", "Q8_0", "GGUF"]
        for quant in quant_types:
            if quant.lower() in tags_str:
                return quant
        return None

    def _extract_context_length(self, card_data: dict) -> int | None:
        """Extract context length from card data."""
        # Common keys for context length
        for key in ["max_position_embeddings", "context_length", "seq_length"]:
            if key in card_data:
                return card_data[key]
        return None

    def _extract_image_model_type(self, tags_str: str) -> str:
        """Extract image model type (SD1.5, SDXL, SD3, etc.)."""
        if "sdxl" in tags_str:
            return "SDXL"
        elif "sd3" in tags_str or "stable-diffusion-3" in tags_str:
            return "SD3"
        elif "stable-diffusion" in tags_str:
            return "SD1.5"
        return "Unknown"

    def _extract_whisper_size(self, model_id: str, tags_str: str) -> str | None:
        """Extract Whisper model size."""
        sizes = ["tiny", "base", "small", "medium", "large", "large-v3"]
        text = (model_id + " " + tags_str).lower()
        for size in sizes:
            if size in text:
                return size
        return None

    def _extract_languages(self, card_data: dict) -> list[str]:
        """Extract supported languages."""
        languages = card_data.get("language", [])
        if isinstance(languages, str):
            return [languages]
        elif isinstance(languages, list):
            return languages
        return []

    def _extract_num_speakers(self, card_data: dict) -> int | None:
        """Extract number of speakers for TTS models."""
        return card_data.get("num_speakers") or card_data.get("speakers")

    def _extract_fps(self, card_data: dict) -> int | None:
        """Extract recommended FPS for video models."""
        return card_data.get("fps") or card_data.get("frame_rate")
