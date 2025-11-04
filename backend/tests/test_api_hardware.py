"""Tests for hardware API endpoints."""
import pytest
from fastapi.testclient import TestClient


def test_get_hardware_profile(client: TestClient):
    """Test GET /hardware endpoint returns hardware profile."""
    response = client.get("/api/v1/hardware")
    assert response.status_code == 200
    
    data = response.json()
    assert "cpu" in data
    assert "memory" in data
    assert "os" in data
    
    # Validate CPU info structure
    cpu = data["cpu"]
    assert "model" in cpu
    assert "cores_physical" in cpu
    assert "cores_logical" in cpu
    assert "instruction_sets" in cpu
    assert isinstance(cpu["instruction_sets"], list)
    
    # Validate Memory info structure
    memory = data["memory"]
    assert "total_gb" in memory
    assert "available_gb" in memory
    
    # Validate OS info
    assert isinstance(data["os"], str)
    assert len(data["os"]) > 0


def test_hardware_profile_gpu_optional(client: TestClient):
    """Test that GPU info is optional in hardware profile."""
    response = client.get("/api/v1/hardware")
    assert response.status_code == 200
    
    data = response.json()
    # GPU can be None or contain GPU info
    if data.get("gpu"):
        gpu = data["gpu"]
        assert "name" in gpu
        assert "total_vram_gb" in gpu
        assert "free_vram_gb" in gpu
        assert "utilization_percent" in gpu


def test_hardware_profile_cpu_cores_positive(client: TestClient):
    """Test that CPU core counts are positive numbers."""
    response = client.get("/api/v1/hardware")
    assert response.status_code == 200
    
    data = response.json()
    cpu = data["cpu"]
    
    if cpu["cores_physical"] is not None:
        assert cpu["cores_physical"] > 0
    
    if cpu["cores_logical"] is not None:
        assert cpu["cores_logical"] > 0
        # Logical cores should be >= physical cores
        if cpu["cores_physical"] is not None:
            assert cpu["cores_logical"] >= cpu["cores_physical"]


def test_hardware_profile_memory_positive(client: TestClient):
    """Test that memory values are positive."""
    response = client.get("/api/v1/hardware")
    assert response.status_code == 200
    
    data = response.json()
    memory = data["memory"]
    
    if memory["total_gb"] is not None:
        assert memory["total_gb"] > 0
    
    if memory["available_gb"] is not None:
        assert memory["available_gb"] >= 0
        # Available should not exceed total
        if memory["total_gb"] is not None:
            assert memory["available_gb"] <= memory["total_gb"]


@pytest.mark.asyncio
async def test_hardware_profile_caching():
    """Test that multiple hardware profile requests work correctly."""
    from httpx import AsyncClient
    from app.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # Make multiple requests
        responses = []
        for _ in range(3):
            response = await ac.get("/api/v1/hardware")
            assert response.status_code == 200
            responses.append(response.json())
        
        # Verify all responses have the same structure
        for i in range(1, len(responses)):
            assert responses[i].keys() == responses[0].keys()
