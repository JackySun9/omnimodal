from __future__ import annotations

from typing import Literal

from app.schemas.hardware import HardwareProfile
from app.schemas.models import DiscoveredModel


class HardwareCompatibility:
    """Represents hardware compatibility for a model."""

    COMPATIBLE = "compatible"
    MARGINAL = "marginal"
    INCOMPATIBLE = "incompatible"

    def __init__(
        self,
        status: Literal["compatible", "marginal", "incompatible"],
        score: float,
        reason: str,
    ) -> None:
        self.status = status
        self.score = score  # 0.0 to 1.0
        self.reason = reason


class RecommendationEngine:
    """Hardware-aware recommendation engine for multimodal models."""

    # VRAM requirements (in GB) for different model sizes and quantization
    VRAM_REQUIREMENTS = {
        "text": {
            # LLM parameter count -> VRAM (base, Q4, Q8)
            "7b": {"base": 14, "Q4_K_M": 4.5, "Q4_0": 4.0, "Q8_0": 8.0},
            "13b": {"base": 26, "Q4_K_M": 8.0, "Q4_0": 7.5, "Q8_0": 14.0},
            "30b": {"base": 60, "Q4_K_M": 18.0, "Q4_0": 17.0, "Q8_0": 32.0},
            "70b": {"base": 140, "Q4_K_M": 40.0, "Q4_0": 38.0, "Q8_0": 75.0},
        },
        "image": {
            # Image model sizes
            "sd1.5": {"base": 4.0, "Q4_0": 2.0, "Q8_0": 3.5},
            "sdxl": {"base": 7.0, "Q4_0": 3.5, "Q8_0": 6.0},
            "sd3": {"base": 8.0, "Q4_0": 4.0, "Q8_0": 7.0},
        },
        "stt": {
            # Whisper model sizes
            "tiny": {"base": 0.5},
            "base": {"base": 0.8},
            "small": {"base": 1.5},
            "medium": {"base": 3.0},
            "large": {"base": 6.0},
            "large-v3": {"base": 6.5},
        },
        "tts": {
            # TTS models are generally small
            "default": {"base": 0.5},
        },
        "video": {
            # Video generation is extremely resource-intensive
            "svd": {"base": 20.0},
            "animatediff": {"base": 16.0},
        },
    }

    def __init__(self, hardware_profile: HardwareProfile) -> None:
        self.hardware = hardware_profile

    def evaluate_model(self, model: DiscoveredModel) -> HardwareCompatibility:
        """
        Evaluate hardware compatibility for a discovered model.

        Returns a compatibility assessment with score and explanation.
        """
        # Extract model size and quantization from metadata
        model_size = self._extract_model_size(model)
        quantization = self._extract_quantization(model)
        modality = self._infer_modality(model)

        # Estimate VRAM requirement
        vram_required = self._estimate_vram_requirement(modality, model_size, quantization)

        # Get available VRAM (or estimate based on system RAM if no GPU)
        vram_available = self._get_available_vram()

        # Calculate compatibility
        return self._calculate_compatibility(modality, vram_required, vram_available, model)

    def _extract_model_size(self, model: DiscoveredModel) -> str | None:
        """Extract model size from tags or name."""
        # Check tags for size indicators
        size_indicators = ["7b", "13b", "30b", "70b", "tiny", "base", "small", "medium", "large"]
        for tag in model.tags:
            tag_lower = tag.lower()
            for indicator in size_indicators:
                if indicator in tag_lower:
                    return indicator

        # Check name
        name = (model.name or model.repo_id).lower()
        for indicator in size_indicators:
            if indicator in name:
                return indicator

        return None

    def _extract_quantization(self, model: DiscoveredModel) -> str | None:
        """Extract quantization level from tags or model files."""
        quant_indicators = ["Q4_K_M", "Q4_0", "Q8_0", "Q5_K_M", "GGUF"]
        for tag in model.tags:
            tag_upper = tag.upper()
            for indicator in quant_indicators:
                if indicator in tag_upper:
                    return indicator

        # Check repo_id for GGUF indicators
        if "gguf" in model.repo_id.lower():
            # Default to Q4_K_M for GGUF if not specified
            return "Q4_K_M"

        return None

    def _infer_modality(self, model: DiscoveredModel) -> str:
        """Infer model modality from task and tags."""
        task = (model.task or "").lower()
        tags_str = " ".join(model.tags).lower()

        # Text generation
        if "text-generation" in task or any(
            x in tags_str for x in ["llm", "language-model", "causal-lm"]
        ):
            return "text"

        # Image generation
        if "text-to-image" in task or any(
            x in tags_str for x in ["stable-diffusion", "diffusion", "image-generation"]
        ):
            return "image"

        # Speech-to-Text
        if "automatic-speech-recognition" in task or "whisper" in tags_str:
            return "stt"

        # Text-to-Speech
        if "text-to-speech" in task or "tts" in tags_str:
            return "tts"

        # Video generation
        if "text-to-video" in task or any(x in tags_str for x in ["video-generation", "svd"]):
            return "video"

        return "text"  # default

    def _estimate_vram_requirement(
        self, modality: str, model_size: str | None, quantization: str | None
    ) -> float:
        """Estimate VRAM requirement in GB."""
        requirements = self.VRAM_REQUIREMENTS.get(modality, {})

        if not model_size:
            # Use conservative default based on modality
            defaults = {"text": 8.0, "image": 6.0, "stt": 3.0, "tts": 1.0, "video": 20.0}
            return defaults.get(modality, 4.0)

        model_reqs = requirements.get(model_size, {})
        if not model_reqs:
            # Unknown size, use conservative estimate
            return 8.0

        # Prefer quantized version if available
        if quantization and quantization in model_reqs:
            return model_reqs[quantization]

        # Fall back to base requirement
        return model_reqs.get("base", 8.0)

    def _get_available_vram(self) -> float:
        """Get available VRAM in GB (or estimate for CPU-only systems)."""
        if self.hardware.gpu and self.hardware.gpu.free_vram_gb:
            return self.hardware.gpu.free_vram_gb

        # No GPU - use system RAM as proxy (models will run on CPU)
        # CPU inference is slower but possible
        if self.hardware.memory.available_gb:
            # Can use about 50% of available RAM for model
            return self.hardware.memory.available_gb * 0.5

        return 4.0  # Conservative fallback

    def _calculate_compatibility(
        self, modality: str, vram_required: float, vram_available: float, model: DiscoveredModel
    ) -> HardwareCompatibility:
        """Calculate final compatibility score and status."""
        # Check for GPU availability for video generation
        if modality == "video" and not self.hardware.gpu:
            return HardwareCompatibility(
                status=HardwareCompatibility.INCOMPATIBLE,
                score=0.0,
                reason="Video generation requires a GPU. No GPU detected on this system.",
            )

        # Calculate ratio
        if vram_required <= 0:
            vram_required = 1.0

        ratio = vram_available / vram_required

        # Determine status and score
        if ratio >= 1.5:
            # Plenty of headroom
            return HardwareCompatibility(
                status=HardwareCompatibility.COMPATIBLE,
                score=min(1.0, ratio / 2.0),
                reason=f"Excellent fit. Requires ~{vram_required:.1f}GB, you have {vram_available:.1f}GB available.",
            )
        elif ratio >= 0.9:
            # Just enough
            return HardwareCompatibility(
                status=HardwareCompatibility.COMPATIBLE,
                score=0.7,
                reason=f"Should work. Requires ~{vram_required:.1f}GB, you have {vram_available:.1f}GB available.",
            )
        elif ratio >= 0.6:
            # Marginal - might work but slow
            return HardwareCompatibility(
                status=HardwareCompatibility.MARGINAL,
                score=0.4,
                reason=f"May be slow or require CPU offloading. Requires ~{vram_required:.1f}GB, you have {vram_available:.1f}GB available.",
            )
        else:
            # Not recommended
            gpu_note = "" if self.hardware.gpu else " Consider a smaller or quantized version."
            return HardwareCompatibility(
                status=HardwareCompatibility.INCOMPATIBLE,
                score=0.1,
                reason=f"Insufficient resources. Requires ~{vram_required:.1f}GB, you have {vram_available:.1f}GB available.{gpu_note}",
            )
