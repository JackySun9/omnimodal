from __future__ import annotations

from typing import Any, Optional

import httpx

from app.executors.base import BaseExecutor
from app.schemas.executors import ExecutionRequest, ExecutionResponse, ExecutorStatus
from app.schemas.models import LocalModel


class OllamaExecutor(BaseExecutor):
    """Executor for Ollama text generation models."""

    name = "ollama"
    modality = "text"
    runtime_name = "ollama"

    def __init__(
        self,
        *,
        auto_start: bool = False,
        base_url: str = "http://localhost:11434",
    ) -> None:
        super().__init__(auto_start=auto_start)
        self.base_url = base_url
        self._loaded_model: Optional[str] = None
        self._client = httpx.AsyncClient(timeout=300.0)  # 5 minute timeout for generation

    async def load_model(self, model: LocalModel) -> None:
        """Load a model into Ollama runtime."""
        # Ollama loads models on-demand, but we can verify it exists
        try:
            # Try to pull the model if not already available
            model_name = model.name
            async with self._client.stream(
                "POST",
                f"{self.base_url}/api/pull",
                json={"name": model_name},
            ) as response:
                response.raise_for_status()
                # Stream and discard pull progress
                async for _ in response.aiter_text():
                    pass
            self._loaded_model = model_name
        except Exception as e:
            raise RuntimeError(f"Failed to load model {model.name} into Ollama: {e}")

    async def get_status(self) -> ExecutorStatus:
        """Check if Ollama service is running and healthy."""
        try:
            response = await self._client.get(f"{self.base_url}/api/tags")
            response.raise_for_status()
            models = response.json().get("models", [])
            return ExecutorStatus(
                name=self.name,
                is_running=True,
                healthy=True,
                detail={"available_models": [m["name"] for m in models]},
            )
        except Exception as e:
            return ExecutorStatus(
                name=self.name,
                is_running=False,
                healthy=False,
                detail={"reason": f"Cannot connect to Ollama: {str(e)}"},
            )

    async def generate_text(self, params: dict[str, Any]) -> ExecutionResponse:
        """
        Generate text using Ollama's API.

        Expected params:
        - model: str (model name)
        - prompt: str (input prompt)
        - stream: bool (default: False)
        - temperature: float (default: 0.7)
        - max_tokens: int (default: 512)
        - system: str (optional system message)
        - history: list (optional conversation history)
        """
        model_name = params.get("model", self._loaded_model)
        if not model_name:
            return ExecutionResponse(
                status="error",
                result={"error": "No model specified or loaded"},
            )

        prompt = params.get("prompt", "")
        system_message = params.get("system")
        temperature = params.get("temperature", 0.7)
        max_tokens = params.get("max_tokens", 512)
        should_stream = params.get("stream", False)
        history = params.get("history", [])

        try:
            # Build the full prompt with history if provided
            if history:
                # Use Ollama's chat API for conversation history
                messages = []
                if system_message:
                    messages.append({"role": "system", "content": system_message})
                
                # Add history messages
                for msg in history:
                    messages.append({
                        "role": msg.get("role", "user"),
                        "content": msg.get("content", ""),
                    })
                
                # Add current prompt
                messages.append({"role": "user", "content": prompt})
                
                payload: dict[str, Any] = {
                    "model": model_name,
                    "messages": messages,
                    "stream": should_stream,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                    },
                }
                
                response = await self._client.post(
                    f"{self.base_url}/api/chat",
                    json=payload,
                )
            else:
                # Use generate API for stateless mode
                payload: dict[str, Any] = {
                    "model": model_name,
                    "prompt": prompt,
                    "stream": should_stream,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                    },
                }

                if system_message:
                    payload["system"] = system_message
                
                response = await self._client.post(
                    f"{self.base_url}/api/generate",
                    json=payload,
                )

            
            response.raise_for_status()
            data = response.json()

            # Extract text from response (different for chat vs generate)
            if history:
                text = data.get("message", {}).get("content", "")
            else:
                text = data.get("response", "")

            return ExecutionResponse(
                status="completed",
                result={
                    "text": text,
                    "model": model_name,
                    "done": data.get("done", False),
                    "context": data.get("context", []),
                },
                metadata={
                    "total_duration": data.get("total_duration"),
                    "load_duration": data.get("load_duration"),
                    "prompt_eval_count": data.get("prompt_eval_count"),
                    "eval_count": data.get("eval_count"),
                },
            )
        except Exception as e:
            return ExecutionResponse(
                status="error",
                result={"error": str(e)},
            )
    
    async def generate_text_stream(self, params: dict[str, Any]):
        """
        Generate text using Ollama's API with streaming.
        
        Yields chunks of text as they're generated.
        """
        model_name = params.get("model", self._loaded_model)
        if not model_name:
            yield {"error": "No model specified or loaded"}
            return

        prompt = params.get("prompt", "")
        system_message = params.get("system")
        temperature = params.get("temperature", 0.7)
        max_tokens = params.get("max_tokens", 512)
        history = params.get("history", [])

        try:
            import json
            
            # Build the payload based on whether we have history
            if history:
                # Use chat API with conversation history
                messages = []
                if system_message:
                    messages.append({"role": "system", "content": system_message})
                
                # Add history messages
                for msg in history:
                    messages.append({
                        "role": msg.get("role", "user"),
                        "content": msg.get("content", ""),
                    })
                
                # Add current prompt
                messages.append({"role": "user", "content": prompt})
                
                payload: dict[str, Any] = {
                    "model": model_name,
                    "messages": messages,
                    "stream": True,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                    },
                }
                
                async with self._client.stream(
                    "POST",
                    f"{self.base_url}/api/chat",
                    json=payload,
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if line.strip():
                            chunk = json.loads(line)
                            # Extract text from chat response
                            text = chunk.get("message", {}).get("content", "")
                            yield {
                                "text": text,
                                "done": chunk.get("done", False),
                            }
            else:
                # Use generate API for stateless mode
                payload: dict[str, Any] = {
                    "model": model_name,
                    "prompt": prompt,
                    "stream": True,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                    },
                }

                if system_message:
                    payload["system"] = system_message

                async with self._client.stream(
                    "POST",
                    f"{self.base_url}/api/generate",
                    json=payload,
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if line.strip():
                            chunk = json.loads(line)
                            yield {
                                "text": chunk.get("response", ""),
                                "done": chunk.get("done", False),
                            }
        except Exception as e:
            yield {"error": str(e)}

    async def execute(self, request: ExecutionRequest) -> ExecutionResponse:
        """Execute a text generation request."""
        return await self.generate_text(request.parameters)

    async def unload_model(self, model_id: Any) -> None:
        """Unload a model from Ollama (no-op as Ollama manages this automatically)."""
        self._loaded_model = None

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()
