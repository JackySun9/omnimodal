#!/usr/bin/env python3
"""
OllamaDiffuser Server - A REST API service for Stable Diffusion and Flux models.
Compatible with the unified-multimodal-platform backend.
"""

import os
import io
import base64
import json
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any

import torch
from diffusers import FluxPipeline, DiffusionPipeline
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel, Field
import uvicorn

# Configuration
MODELS_DIR = Path.home() / ".ollamadiffuser" / "models"
DEVICE = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"
PORT = 11435

# Global state
app = FastAPI(title="OllamaDiffuser API", version="1.0.0")
current_pipeline: Optional[DiffusionPipeline] = None
current_model_name: Optional[str] = None


class HealthResponse(BaseModel):
    status: str = "healthy"
    model_loaded: bool = False
    current_model: Optional[str] = None
    device: str = DEVICE


class ModelsResponse(BaseModel):
    available: List[str] = []


class LoadModelRequest(BaseModel):
    model_name: str


class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: str = "low quality, bad anatomy, worst quality"
    width: int = 1024
    height: int = 1024
    steps: int = 28
    guidance_scale: float = 3.5
    seed: Optional[int] = None
    control_image: Optional[str] = None
    controlnet_conditioning_scale: float = 1.0


class PullRequest(BaseModel):
    name: str


def get_available_models() -> List[str]:
    """Scan the models directory for available models."""
    models = []
    if MODELS_DIR.exists():
        for item in MODELS_DIR.iterdir():
            if item.is_dir() and not item.name.startswith('.'):
                # Skip helper models and GGUF models (not supported yet)
                if item.name not in ['flux_text_encoders', 'flux_vae', 'backup', 'sd35_text_encoders', 'sd35_vae']:
                    # Check if it's a valid diffusers model or skip GGUF
                    if is_valid_model(item):
                        models.append(item.name)
    return sorted(models)


def is_valid_model(model_path: Path) -> bool:
    """Check if a model directory is valid for loading."""
    # GGUF models are single files, not supported by diffusers directly
    if "gguf" in model_path.name.lower():
        return False
    
    # Check for model_index.json (standard diffusers format)
    if (model_path / "model_index.json").exists():
        return True
    
    # ControlNet models may not have model_index.json
    if "controlnet" in model_path.name.lower():
        return True
    
    return False


def get_model_path(model_name: str) -> Path:
    """Get the full path to a model."""
    return MODELS_DIR / model_name


@app.get("/api/health")
async def health() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        model_loaded=current_pipeline is not None,
        current_model=current_model_name,
        device=DEVICE,
    )


@app.get("/api/models")
async def list_models() -> ModelsResponse:
    """List available models."""
    return ModelsResponse(available=get_available_models())


@app.get("/api/tags")
async def list_tags() -> Dict[str, Any]:
    """List available models (Ollama-compatible endpoint)."""
    models = get_available_models()
    return {
        "models": [
            {
                "name": model,
                "modified_at": "2024-01-01T00:00:00Z",
                "size": 0,
            }
            for model in models
        ]
    }


@app.post("/api/models/load")
async def load_model(request: LoadModelRequest) -> JSONResponse:
    """Load a model into memory."""
    global current_pipeline, current_model_name
    
    model_path = get_model_path(request.model_name)
    
    if not model_path.exists():
        raise HTTPException(status_code=404, detail=f"Model {request.model_name} not found")
    
    # Check if model is valid
    if not is_valid_model(model_path):
        raise HTTPException(
            status_code=400, 
            detail=f"Model {request.model_name} is not supported. GGUF models are not yet supported. Please use the full diffusers format models (flux.1-dev, flux.1-schnell, stable-diffusion-*)."
        )
    
    try:
        print(f"Loading model: {request.model_name} from {model_path}")
        
        # Unload current model if loaded
        if current_pipeline is not None:
            print(f"Unloading current model: {current_model_name}")
            del current_pipeline
            if DEVICE == "mps":
                torch.mps.empty_cache()
            elif DEVICE == "cuda":
                torch.cuda.empty_cache()
            current_pipeline = None
        
        # Load the new model
        # For Flux models
        if "flux" in request.model_name.lower():
            print("Loading as FluxPipeline...")
            current_pipeline = FluxPipeline.from_pretrained(
                str(model_path),
                torch_dtype=torch.bfloat16 if DEVICE != "cpu" else torch.float32,
            )
        else:
            # For other diffusion models (Stable Diffusion, etc.)
            print("Loading as DiffusionPipeline...")
            current_pipeline = DiffusionPipeline.from_pretrained(
                str(model_path),
                torch_dtype=torch.float16 if DEVICE != "cpu" else torch.float32,
                use_safetensors=True,
            )
        
        # Move to device
        print(f"Moving pipeline to {DEVICE}...")
        current_pipeline = current_pipeline.to(DEVICE)
        current_model_name = request.model_name
        
        print(f"✅ Model {request.model_name} loaded successfully on {DEVICE}")
        
        return JSONResponse(
            content={
                "status": "success",
                "model": request.model_name,
                "device": DEVICE,
            }
        )
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"❌ Error loading model: {e}")
        print(error_details)
        current_pipeline = None
        current_model_name = None
        raise HTTPException(status_code=500, detail=f"Failed to load model: {str(e)}")


@app.post("/api/pull")
async def pull_model(request: PullRequest):
    """Pull/verify a model (compatibility endpoint - models are already local)."""
    model_path = get_model_path(request.name)
    
    if not model_path.exists():
        return JSONResponse(
            status_code=404,
            content={"error": f"Model {request.name} not found in {MODELS_DIR}"}
        )
    
    # Model exists locally, just return success
    return JSONResponse(
        content={
            "status": "success",
            "message": f"Model {request.name} is available locally",
        }
    )


@app.post("/api/generate")
async def generate_image(request: GenerateRequest) -> Response:
    """Generate an image using the loaded model."""
    global current_pipeline
    
    if current_pipeline is None:
        raise HTTPException(status_code=400, detail="No model loaded. Load a model first.")
    
    try:
        print(f"Generating image with prompt: {request.prompt[:50]}...")
        
        # Set seed if provided (seed >= 0 is valid, None means random)
        generator = None
        if request.seed is not None and request.seed >= 0:
            generator = torch.Generator(device=DEVICE).manual_seed(request.seed)
        
        # Generate image
        result = current_pipeline(
            prompt=request.prompt,
            negative_prompt=request.negative_prompt,
            width=request.width,
            height=request.height,
            num_inference_steps=request.steps,
            guidance_scale=request.guidance_scale,
            generator=generator,
        )
        
        # Get the first image
        image = result.images[0]
        
        # Convert to PNG bytes
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)
        
        print(f"Image generated successfully ({request.width}x{request.height})")
        
        # Return raw PNG bytes
        return Response(content=img_byte_arr.getvalue(), media_type="image/png")
    
    except Exception as e:
        print(f"Error generating image: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate image: {str(e)}")


@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "name": "OllamaDiffuser API",
        "version": "1.0.0",
        "status": "running",
        "device": DEVICE,
        "models_directory": str(MODELS_DIR),
        "available_models": len(get_available_models()),
    }


def main():
    """Start the OllamaDiffuser server."""
    print("=" * 60)
    print("🎨 OllamaDiffuser Server Starting...")
    print("=" * 60)
    print(f"Device: {DEVICE}")
    print(f"Models Directory: {MODELS_DIR}")
    print(f"Port: {PORT}")
    print(f"Available Models: {len(get_available_models())}")
    print()
    print("Available models:")
    for model in get_available_models():
        print(f"  - {model}")
    print()
    print(f"Server URL: http://localhost:{PORT}")
    print(f"Health Check: http://localhost:{PORT}/api/health")
    print(f"List Models: http://localhost:{PORT}/api/models")
    print("=" * 60)
    
    # Start server
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")


if __name__ == "__main__":
    main()
