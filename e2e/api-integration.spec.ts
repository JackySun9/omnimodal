import { test, expect } from './fixtures';

test.describe('API Integration', () => {
  test('should successfully fetch hardware profile', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/hardware');
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('cpu');
    expect(data).toHaveProperty('memory');
    expect(data).toHaveProperty('os');
  });

  test('should successfully fetch models list', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/models/local');
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('models');
    expect(Array.isArray(data.models)).toBeTruthy();
  });

  test('should handle executor status requests', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/executors/ollama/status');
    
    // Should return 200 or 404 (if executor not found)
    expect([200, 404]).toContain(response.status());
    
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('is_running');
      expect(data).toHaveProperty('healthy');
    }
  });

  test('should handle CORS headers', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/hardware', {
      headers: {
        'Origin': 'http://localhost:5173'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    // Check for CORS headers
    const headers = response.headers();
    expect(headers['access-control-allow-origin']).toBeDefined();
  });

  test('should handle model discovery', async ({ request }) => {
    const response = await request.post('http://localhost:8000/api/v1/models/discover', {
      data: {
        modality: 'text',
        executor_type: 'ollama',
        query: '',
        limit: 10
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('items');
    expect(Array.isArray(data.items)).toBeTruthy();
  });

  test('should validate request payloads', async ({ request }) => {
    // Send invalid payload
    const response = await request.post('http://localhost:8000/api/v1/models/discover', {
      data: {
        // Missing required fields
        modality: 'invalid_modality'
      }
    });
    
    // Should return validation error
    expect(response.status()).toBe(422);
  });

  test('should handle concurrent requests', async ({ request }) => {
    // Make multiple concurrent requests
    const requests = [
      request.get('http://localhost:8000/api/v1/hardware'),
      request.get('http://localhost:8000/api/v1/models/local'),
      request.get('http://localhost:8000/api/v1/executors/ollama/status'),
    ];
    
    const responses = await Promise.all(requests);
    
    // All should complete successfully
    for (const response of responses) {
      expect([200, 404, 503]).toContain(response.status());
    }
  });
});
