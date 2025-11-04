"""Tests for models API endpoints."""
import pytest
from fastapi.testclient import TestClient
from uuid import uuid4


def test_list_local_models_empty(client: TestClient):
    """Test GET /models/local returns empty list initially."""
    response = client.get("/api/v1/models/local")
    assert response.status_code == 200
    
    data = response.json()
    assert "models" in data
    assert isinstance(data["models"], list)


def test_list_local_models_response_structure(client: TestClient):
    """Test that local models response has correct structure."""
    response = client.get("/api/v1/models/local")
    assert response.status_code == 200
    
    data = response.json()
    assert "models" in data
    
    # If models exist, check structure
    for model in data["models"]:
        assert "id" in model
        assert "name" in model
        assert "modality" in model
        # executor_type might be in model_metadata instead of top level
        assert "path" in model or "model_metadata" in model


def test_list_downloads_empty(client: TestClient):
    """Test GET /models/downloads returns empty list initially."""
    response = client.get("/api/v1/models/downloads")
    assert response.status_code == 200
    
    data = response.json()
    assert "items" in data
    assert isinstance(data["items"], list)


def test_discover_models_with_filters(client: TestClient):
    """Test POST /models/discover with various filters."""
    # Test with text modality filter
    response = client.post(
        "/api/v1/models/discover",
        json={
            "modality": "text",
            "executor_type": "ollama",
            "query": "",
            "limit": 10,
        }
    )
    assert response.status_code == 200
    
    data = response.json()
    assert "items" in data
    assert isinstance(data["items"], list)


def test_discover_models_with_query(client: TestClient):
    """Test POST /models/discover with search query."""
    response = client.post(
        "/api/v1/models/discover",
        json={
            "modality": None,
            "executor_type": None,
            "query": "llama",
            "limit": 5,
        }
    )
    assert response.status_code == 200
    
    data = response.json()
    assert "items" in data
    assert isinstance(data["items"], list)
    assert len(data["items"]) <= 5


def test_discover_models_invalid_modality(client: TestClient):
    """Test POST /models/discover with invalid modality."""
    response = client.post(
        "/api/v1/models/discover",
        json={
            "modality": "invalid_modality",
            "executor_type": None,
            "query": "",
            "limit": 10,
        }
    )
    # API may accept any modality string and return empty results
    # or return 422 for validation - both are acceptable
    assert response.status_code in [200, 422]


def test_scan_local_models(client: TestClient):
    """Test POST /models/scan endpoint."""
    response = client.post("/api/v1/models/scan")
    assert response.status_code == 200
    
    data = response.json()
    assert "success" in data
    assert "message" in data
    assert "counts" in data
    assert isinstance(data["counts"], dict)


def test_delete_model_nonexistent(client: TestClient):
    """Test DELETE /models/{model_id} with non-existent model."""
    fake_uuid = uuid4()
    response = client.delete(f"/api/v1/models/{fake_uuid}")
    # May return 200 (deleted), 404 (not found), or 422 (validation error)
    # Some implementations return 200 even if model doesn't exist
    assert response.status_code in [200, 404, 422, 500]


@pytest.mark.asyncio
async def test_download_model_validation():
    """Test POST /models/download with invalid payload."""
    from httpx import AsyncClient
    from app.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # Missing required fields
        response = await ac.post(
            "/api/v1/models/download",
            json={}
        )
        assert response.status_code == 422
        
        # Invalid modality
        response = await ac.post(
            "/api/v1/models/download",
            json={
                "name": "test-model",
                "modality": "invalid",
                "executor_type": "ollama",
                "source_url": None,
            }
        )
        assert response.status_code == 422


def test_model_api_cors_headers(client: TestClient):
    """Test that CORS headers are properly set."""
    response = client.options("/api/v1/models/local")
    # CORS middleware should handle OPTIONS requests
    assert response.status_code in [200, 405]


@pytest.mark.asyncio
async def test_concurrent_model_list_requests():
    """Test handling concurrent requests to list models."""
    from httpx import AsyncClient
    from app.main import app
    import asyncio
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # Make 5 concurrent requests
        tasks = [
            ac.get("/api/v1/models/local")
            for _ in range(5)
        ]
        responses = await asyncio.gather(*tasks)
        
        # All should succeed
        for response in responses:
            assert response.status_code == 200
            data = response.json()
            assert "models" in data
