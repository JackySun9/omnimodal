from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

from loguru import logger

from app.models.local_model import LocalModelRecord
from app.core.db import get_session
from sqlmodel import select


class LocalModelScanner:
    """
    Scans local directories for existing models and imports them into the database.
    
    Supports:
    - Ollama models (~/.ollama/models)
    - HuggingFace cached models (~/.cache/huggingface/hub)
    - OllamaDiffuser models (~/.ollamadiffuser/models)
    """

    def __init__(self) -> None:
        self.home_dir = Path.home()
        self.ollama_dir = self.home_dir / ".ollama" / "models"
        self.hf_cache_dir = self.home_dir / ".cache" / "huggingface" / "hub"
        self.diffuser_dir = self.home_dir / ".ollamadiffuser" / "models"
        self.whisper_cache_dir = self.home_dir / ".cache" / "whisper"

    async def scan_all(self) -> dict[str, int]:
        """Scan all known model directories and return count of models found."""
        counts = {
            "ollama": 0,
            "huggingface": 0,
            "ollamadiffuser": 0,
            "whisper": 0,
        }
        
        # Scan Ollama models
        try:
            ollama_models = await self._scan_ollama_models()
            counts["ollama"] = len(ollama_models)
            await self._import_models(ollama_models)
            logger.info(f"Found {counts['ollama']} Ollama models")
        except Exception as e:
            logger.error(f"Error scanning Ollama models: {e}")

        # Scan HuggingFace cache
        try:
            hf_models = await self._scan_huggingface_cache()
            counts["huggingface"] = len(hf_models)
            await self._import_models(hf_models)
            logger.info(f"Found {counts['huggingface']} HuggingFace models")
        except Exception as e:
            logger.error(f"Error scanning HuggingFace cache: {e}")

        # Scan OllamaDiffuser models
        try:
            diffuser_models = await self._scan_ollamadiffuser_models()
            counts["ollamadiffuser"] = len(diffuser_models)
            await self._import_models(diffuser_models)
            logger.info(f"Found {counts['ollamadiffuser']} OllamaDiffuser models")
        except Exception as e:
            logger.error(f"Error scanning OllamaDiffuser models: {e}")

        # Scan/Create Whisper models
        try:
            whisper_models = await self._scan_whisper_models()
            counts["whisper"] = len(whisper_models)
            await self._import_models(whisper_models)
            logger.info(f"Found/Created {counts['whisper']} Whisper models")
        except Exception as e:
            logger.error(f"Error scanning Whisper models: {e}")

        return counts

    async def _scan_ollama_models(self) -> list[dict[str, Any]]:
        """Scan Ollama models using 'ollama list' command."""
        models = []
        
        try:
            # Use ollama CLI to list models
            result = subprocess.run(
                ["ollama", "list"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode != 0:
                logger.warning("Ollama not available or no models found")
                return models
            
            # Parse output (skip header line)
            lines = result.stdout.strip().split('\n')[1:]
            
            for line in lines:
                if not line.strip():
                    continue
                
                parts = line.split()
                if len(parts) < 4:
                    continue
                
                model_name = parts[0]
                model_id = parts[1]
                size_str = parts[2]
                
                # Parse size (e.g., "5.2 GB" -> bytes)
                size_bytes = self._parse_size(size_str)
                
                # Infer modality from model name
                modality = self._infer_modality_from_name(model_name)
                
                models.append({
                    "name": model_name,
                    "modality": modality,
                    "path": str(self.ollama_dir / "manifests" / "registry.ollama.ai" / "library" / model_name.split(':')[0]),
                    "size_bytes": size_bytes,
                    "model_metadata": {
                        "source": "ollama",
                        "model_id": model_id,
                        "executor": "ollama",
                    }
                })
        
        except FileNotFoundError:
            logger.warning("Ollama CLI not found in PATH")
        except Exception as e:
            logger.error(f"Error scanning Ollama models: {e}")
        
        return models

    async def _scan_huggingface_cache(self) -> list[dict[str, Any]]:
        """Scan HuggingFace cache directory."""
        models = []
        
        if not self.hf_cache_dir.exists():
            return models
        
        try:
            # List all model directories in hub cache
            for model_dir in self.hf_cache_dir.iterdir():
                if not model_dir.is_dir() or not model_dir.name.startswith("models--"):
                    continue
                
                # Extract model name from directory (models--org--name -> org/name)
                model_name = model_dir.name.replace("models--", "").replace("--", "/")
                
                # Calculate directory size
                size_bytes = self._get_directory_size(model_dir)
                
                # Try to read snapshot info
                snapshots_dir = model_dir / "snapshots"
                version = None
                if snapshots_dir.exists():
                    # Get most recent snapshot
                    snapshots = sorted(snapshots_dir.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True)
                    if snapshots:
                        version = snapshots[0].name[:8]  # Short hash
                
                # Infer modality
                modality = self._infer_modality_from_name(model_name)
                
                models.append({
                    "name": model_name,
                    "modality": modality,
                    "version": version,
                    "path": str(model_dir),
                    "size_bytes": size_bytes,
                    "model_metadata": {
                        "source": "huggingface",
                        "executor": self._get_executor_for_modality(modality),
                    }
                })
        
        except Exception as e:
            logger.error(f"Error scanning HuggingFace cache: {e}")
        
        return models

    async def _scan_ollamadiffuser_models(self) -> list[dict[str, Any]]:
        """Scan OllamaDiffuser models directory."""
        models = []
        
        if not self.diffuser_dir.exists():
            return models
        
        try:
            for model_dir in self.diffuser_dir.iterdir():
                if not model_dir.is_dir():
                    continue
                
                model_name = model_dir.name
                size_bytes = self._get_directory_size(model_dir)
                
                models.append({
                    "name": model_name,
                    "modality": "image",  # OllamaDiffuser is for image generation
                    "path": str(model_dir),
                    "size_bytes": size_bytes,
                    "model_metadata": {
                        "source": "ollamadiffuser",
                        "executor": "ollama-diffuser",
                    }
                })
        
        except Exception as e:
            logger.error(f"Error scanning OllamaDiffuser models: {e}")
        
        return models

    async def _scan_whisper_models(self) -> list[dict[str, Any]]:
        """Scan for Whisper models and create virtual entries for available models."""
        models = []
        
        # Define available Whisper models
        whisper_model_specs = [
            {"name": "tiny", "size_mb": 72, "params": "39M"},
            {"name": "base", "size_mb": 142, "params": "74M"},
            {"name": "small", "size_mb": 466, "params": "244M"},
            {"name": "medium", "size_mb": 1464, "params": "769M"},
            {"name": "large", "size_mb": 2944, "params": "1550M"},
            {"name": "large-v2", "size_mb": 2944, "params": "1550M"},
            {"name": "large-v3", "size_mb": 2944, "params": "1550M"},
        ]
        
        # Check which models are already downloaded
        downloaded_models = set()
        if self.whisper_cache_dir.exists():
            for file in self.whisper_cache_dir.iterdir():
                if file.is_file() and file.suffix == ".pt":
                    downloaded_models.add(file.stem)
        
        # Create entries for all models (downloaded or available for download)
        for spec in whisper_model_specs:
            model_name = f"whisper-{spec['name']}"
            is_downloaded = spec['name'] in downloaded_models
            
            # Calculate path and size
            if is_downloaded:
                model_path = str(self.whisper_cache_dir / f"{spec['name']}.pt")
                try:
                    size_bytes = (self.whisper_cache_dir / f"{spec['name']}.pt").stat().st_size
                except:
                    size_bytes = spec['size_mb'] * 1024 * 1024
            else:
                model_path = f"virtual://whisper/{spec['name']}"
                size_bytes = spec['size_mb'] * 1024 * 1024
            
            models.append({
                "name": model_name,
                "modality": "stt",
                "path": model_path,
                "size_bytes": size_bytes,
                "model_metadata": {
                    "source": "whisper",
                    "executor": "faster-whisper-stt",  # Default to faster-whisper
                    "model_size": spec['name'],
                    "parameters": spec['params'],
                    "is_downloaded": is_downloaded,
                    "description": f"Whisper {spec['name']} model for speech-to-text",
                }
            })
        
        return models

    async def _import_models(self, models: list[dict[str, Any]]) -> None:
        """Import models into the database, avoiding duplicates."""
        async for session in get_session():
            for model_data in models:
                # Check if model already exists (by name and path)
                stmt = select(LocalModelRecord).where(
                    LocalModelRecord.name == model_data["name"],
                    LocalModelRecord.path == model_data["path"]
                )
                result = await session.exec(stmt)
                existing = result.first()
                
                if existing:
                    # Update size if changed
                    if model_data.get("size_bytes") and existing.size_bytes != model_data["size_bytes"]:
                        existing.size_bytes = model_data["size_bytes"]
                        session.add(existing)
                    continue
                
                # Create new record
                record = LocalModelRecord(
                    name=model_data["name"],
                    modality=model_data["modality"],
                    version=model_data.get("version"),
                    path=model_data["path"],
                    size_bytes=model_data.get("size_bytes"),
                    model_metadata=model_data.get("model_metadata", {}),
                )
                session.add(record)
            
            await session.commit()

    def _parse_size(self, size_str: str) -> int | None:
        """Parse size string like '5.2 GB' to bytes."""
        try:
            parts = size_str.split()
            if len(parts) != 2:
                return None
            
            value = float(parts[0])
            unit = parts[1].upper()
            
            multipliers = {
                "B": 1,
                "KB": 1024,
                "MB": 1024**2,
                "GB": 1024**3,
                "TB": 1024**4,
            }
            
            return int(value * multipliers.get(unit, 1))
        except Exception:
            return None

    def _get_directory_size(self, directory: Path) -> int:
        """Calculate total size of directory in bytes."""
        total = 0
        try:
            for entry in directory.rglob('*'):
                if entry.is_file():
                    total += entry.stat().st_size
        except Exception:
            pass
        return total

    def _infer_modality_from_name(self, name: str) -> str:
        """Infer model modality from its name."""
        name_lower = name.lower()
        
        # Speech-to-text
        if any(x in name_lower for x in ["whisper", "stt", "speech", "asr", "transcribe"]):
            return "stt"
        
        # Image generation
        if any(x in name_lower for x in ["flux", "sd", "stable-diffusion", "sdxl", "diffusion", "imagen"]):
            return "image"
        
        # Vision/multimodal
        if any(x in name_lower for x in ["vision", "vl", "clip", "blip"]):
            return "text"  # Often text models with vision capability
        
        # Embedding models
        if any(x in name_lower for x in ["embed", "embedding", "sentence"]):
            return "text"
        
        # Default to text for LLMs
        return "text"

    def _get_executor_for_modality(self, modality: str) -> str:
        """Get the appropriate executor for a modality."""
        executor_map = {
            "text": "ollama",
            "image": "ollama-diffuser",
            "stt": "whispercpp-stt",
            "tts": "piper-tts",
            "video": "stable-video-diffusion",
        }
        return executor_map.get(modality, "ollama")


# Global instance
local_model_scanner = LocalModelScanner()
