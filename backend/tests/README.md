# Backend Tests

API endpoint tests for the Unified Multimodal Platform backend.

## Running Tests

```bash
# All tests
uv run pytest

# With coverage
uv run pytest --cov=app --cov-report=html

# Specific file
uv run pytest tests/test_api_hardware.py

# Specific test
uv run pytest tests/test_api_hardware.py::test_get_hardware_profile

# Verbose
uv run pytest -v

# Show print output
uv run pytest -s
```

## Test Files

- `conftest.py` - Shared fixtures and test configuration
- `test_api_hardware.py` - Hardware profile endpoint tests
- `test_api_models.py` - Model management endpoint tests
- `test_api_executors.py` - Executor status endpoint tests
- `test_api_stt.py` - Speech-to-text endpoint tests

## Writing Tests

### Basic Test Structure

```python
def test_endpoint_name(client: TestClient):
    """Test description."""
    response = client.get("/api/v1/endpoint")
    assert response.status_code == 200
    assert "expected_key" in response.json()
```

### Async Tests

```python
@pytest.mark.asyncio
async def test_async_endpoint():
    """Test async endpoint."""
    from httpx import AsyncClient
    from app.main import app
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/api/v1/endpoint")
        assert response.status_code == 200
```

## Fixtures

Available fixtures from `conftest.py`:

- `engine` - Test database engine
- `session` - Test database session
- `client` - Synchronous test client
- `async_client` - Asynchronous test client

## Coverage

View coverage report:
```bash
open htmlcov/index.html  # macOS
xdg-open htmlcov/index.html  # Linux
```
