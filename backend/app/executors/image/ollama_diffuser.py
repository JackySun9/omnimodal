from __future__ import annotations

from typing import Any, Optional

import httpx

from app.executors.base import BaseExecutor
from app.schemas.executors import ExecutionRequest, ExecutionResponse, ExecutorStatus
from app.schemas.models import LocalModel


class OllamaDiffuserExecutor(BaseExecutor):
    """Executor for OllamaDiffuser image generation models."""

    name = "ollama-diffuser"
    modality = "image"
    runtime_name = "ollama-diffuser"

    def __init__(
        self,
        *,
        auto_start: bool = False,
        base_url: str = "http://localhost:11435",
    ) -> None:
        super().__init__(auto_start=auto_start)
        self.base_url = base_url
        self._loaded_model: Optional[str] = None
        self._client = httpx.AsyncClient(timeout=600.0)  # 10 minute timeout for image generation

    async def load_model(self, model: LocalModel) -> None:
        """Load a model into OllamaDiffuser runtime."""
        try:
            model_name = model.name
            # OllamaDiffuser may require pulling the model first
            async with self._client.stream(
                "POST",
                f"{self.base_url}/api/pull",
                json={"name": model_name},
            ) as response:
                response.raise_for_status()
                async for _ in response.aiter_text():
                    pass
            self._loaded_model = model_name
        except Exception as e:
            raise RuntimeError(f"Failed to load model {model.name} into OllamaDiffuser: {e}")

    async def get_status(self) -> ExecutorStatus:
        """Check if OllamaDiffuser service is running and healthy."""
        try:
            # Use /api/health endpoint
            response = await self._client.get(f"{self.base_url}/api/health")
            response.raise_for_status()
            data = response.json()
            
            # Get available models
            models_response = await self._client.get(f"{self.base_url}/api/models")
            models_response.raise_for_status()
            models_data = models_response.json()
            
            return ExecutorStatus(
                name=self.name,
                is_running=True,
                healthy=data.get("status") == "healthy",
                detail={
                    "available_models": models_data.get("available", []),
                    "current_model": data.get("current_model"),
                    "model_loaded": data.get("model_loaded", False),
                },
            )
        except Exception as e:
            return ExecutorStatus(
                name=self.name,
                is_running=False,
                healthy=False,
                detail={"reason": f"Cannot connect to OllamaDiffuser: {str(e)}"},
            )

    async def generate_image(self, params: dict[str, Any]) -> ExecutionResponse:
        """
        Generate images using OllamaDiffuser's API.

        Expected params:
        - model: str (model name)
        - prompt: str (text prompt)
        - negative_prompt: str (optional)
        - width: int (default: 1024)
        - height: int (default: 1024)
        - steps: int (default: 28)
        - cfg_scale: float (default: 3.5)
        - seed: int (optional, random if not specified)
        - num_images: int (default: 1)
        - lora: str (optional, LoRA name)
        - lora_scale: float (optional, LoRA strength 0-1)
        - control_image: str (optional, base64 image for ControlNet)
        - controlnet_conditioning_scale: float (optional, default: 1.0)
        """
        model_name = params.get("model", self._loaded_model)
        if not model_name:
            return ExecutionResponse(
                status="error",
                result={"error": "No model specified or loaded"},
            )

        prompt = params.get("prompt", "")
        negative_prompt = params.get("negative_prompt", "low quality, bad anatomy, worst quality")
        width = params.get("width", 1024)
        height = params.get("height", 1024)
        steps = params.get("steps", 28)
        cfg_scale = params.get("cfg_scale", 3.5)
        seed = params.get("seed", -1)
        num_images = params.get("num_images", 1)

        try:
            # Check if model is loaded, if not load it
            health_response = await self._client.get(f"{self.base_url}/api/health")
            health_response.raise_for_status()
            health_data = health_response.json()
            
            current_model = health_data.get("current_model")
            model_loaded = health_data.get("model_loaded", False)
            
            # Load model if not loaded or different model
            if not model_loaded or current_model != model_name:
                load_response = await self._client.post(
                    f"{self.base_url}/api/models/load",
                    json={"model_name": model_name},
                    timeout=120.0,  # Model loading can take time
                )
                load_response.raise_for_status()
                self._loaded_model = model_name
            
            # Build generation payload
            # OllamaDiffuser uses standard diffusers parameter names
            payload: dict[str, Any] = {
                "prompt": prompt,
            }
            
            # Model-specific parameter handling
            # Only SD3/SD3.5 models have issues with num_inference_steps parameter
            is_sd3 = ('stable-diffusion-3' in model_name.lower() or 'sd3' in model_name.lower()) and 'sd3' in model_name.lower()
            
            # Only add parameters that are explicitly set
            if negative_prompt:
                payload["negative_prompt"] = negative_prompt
            if width:
                payload["width"] = width
            if height:
                payload["height"] = height
            
            # OllamaDiffuser expects 'steps' parameter (not 'num_inference_steps')
            # SD3 models don't accept num_inference_steps parameter in the pipeline
            if steps:
                if not is_sd3:
                    payload["steps"] = steps
                else:
                    print(f"[DEBUG] Skipping steps for SD3 model: {model_name}")
            
            if cfg_scale is not None:
                payload["guidance_scale"] = cfg_scale
            
            # Optional: seed (only send if explicitly set and >= 0)
            if seed is not None and seed >= 0:
                payload["seed"] = seed
            
            # Optional: LoRA
            lora = params.get("lora")
            if lora:
                lora_scale = params.get("lora_scale", 0.8)
                # Load LoRA first
                lora_load_response = await self._client.post(
                    f"{self.base_url}/api/lora/load",
                    json={"lora_name": lora, "scale": lora_scale},
                )
                lora_load_response.raise_for_status()
            
            # Optional: ControlNet
            control_image = params.get("control_image")
            if control_image:
                payload["control_image"] = control_image
                payload["controlnet_conditioning_scale"] = params.get(
                    "controlnet_conditioning_scale", 1.0
                )

            # Debug: Print the payload before sending
            import json
            print(f"[DEBUG] Sending generation request to OllamaDiffuser")
            print(f"[DEBUG] Model: {model_name}")
            print(f"[DEBUG] Payload: {json.dumps(payload, indent=2)}")
            
            # Generate images (num_images times if needed)
            all_images = []
            for _ in range(num_images):
                try:
                    response = await self._client.post(
                        f"{self.base_url}/api/generate",
                        json=payload,
                        timeout=300.0,  # 5 minutes for generation
                    )
                    response.raise_for_status()
                    
                    # OllamaDiffuser returns raw binary PNG data
                    import base64
                    image_bytes = response.content
                    base64_image = base64.b64encode(image_bytes).decode('utf-8')
                    all_images.append(base64_image)
                    print(f"[DEBUG] Image generated successfully, size: {len(image_bytes)} bytes")
                except Exception as e:
                    # Log the actual error and payload for debugging
                    print(f"[ERROR] Generation error: {str(e)}")
                    print(f"[ERROR] Payload sent: {json.dumps(payload, indent=2)}")
                    if hasattr(e, 'response'):
                        try:
                            error_detail = e.response.json()
                            print(f"Error response: {json.dumps(error_detail, indent=2)}")
                        except:
                            print(f"Error response text: {e.response.text}")
                    raise

            return ExecutionResponse(
                status="completed",
                result={
                    "images": all_images,
                    "model": model_name,
                },
                metadata={
                    "prompt": prompt,
                    "width": width,
                    "height": height,
                    "steps": steps,
                },
            )
        except Exception as e:
            return ExecutionResponse(
                status="error",
                result={"error": str(e)},
            )

    async def execute(self, request: ExecutionRequest) -> ExecutionResponse:
        """Execute an image generation request."""
        return await self.generate_image(request.parameters)

    async def unload_model(self, model_id: Any) -> None:
        """Unload a model from OllamaDiffuser."""
        self._loaded_model = None

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()
