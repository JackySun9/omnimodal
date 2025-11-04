# Error Handling and Logging Guide

This document describes the comprehensive error handling and logging features implemented in the Unified Multimodal Platform.

## Table of Contents

1. [Backend Error Handling](#backend-error-handling)
2. [Backend Logging](#backend-logging)
3. [Frontend Error Handling](#frontend-error-handling)
4. [Retry Logic](#retry-logic)
5. [Best Practices](#best-practices)

---

## Backend Error Handling

### Custom Exceptions

The backend uses custom exception classes for better error categorization and handling:

```python
from app.core.exceptions import (
    AppException,          # Base exception
    NotFoundError,         # 404 errors
    ValidationError,       # 400 validation errors
    ExecutorError,         # Executor-related errors
    ModelError,            # Model-related errors
    ServiceUnavailableError, # 503 errors
    ConfigurationError,    # Configuration errors
    ExternalServiceError   # External service errors
)
```

#### Example Usage:

```python
from app.core.exceptions import NotFoundError, ExecutorError
from loguru import logger

@router.get("/{executor_name}/status")
async def get_executor_status(executor_name: str):
    try:
        logger.info(f"Getting status for executor: {executor_name}")
        service = ExecutorService()
        status = await service.get_status(executor_name)
        if status is None:
            raise NotFoundError(
                f"Executor '{executor_name}' not found",
                details={"executor_name": executor_name}
            )
        return status
    except NotFoundError:
        raise
    except Exception as e:
        logger.exception(f"Error getting executor status: {e}")
        raise ExecutorError(
            f"Failed to get executor status: {str(e)}",
            details={"executor_name": executor_name}
        )
```

### Error Handling Middleware

The application includes two middleware components:

1. **ErrorHandlingMiddleware**: Catches all exceptions and converts them to structured JSON responses
2. **RequestLoggingMiddleware**: Logs all HTTP requests and responses with timing information

Both are automatically applied in `app/main.py`:

```python
from app.core.middleware import ErrorHandlingMiddleware, RequestLoggingMiddleware

app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(RequestLoggingMiddleware)
```

### Error Response Format

All errors return a structured JSON response:

```json
{
  "detail": "User-friendly error message",
  "error_type": "ExecutorError",
  "details": {
    "executor_name": "ollama-diffuser",
    "additional_context": "..."
  }
}
```

---

## Backend Logging

### Loguru Configuration

Structured logging is configured in `app/core/logging.py`:

```python
from app.core.logging import setup_logging, get_logger

# Setup logging (done in main.py)
setup_logging()

# Use in your modules
logger = get_logger(__name__)
```

### Features:

- **Console Output**: Color-coded logs with detailed formatting
- **File Rotation**: Automatic log rotation at 10MB
- **Log Retention**: 7 days for general logs, 30 days for errors
- **Compression**: Rotated logs are automatically compressed
- **Structured Context**: Add contextual information with `extra` parameter

### Log Levels:

```python
logger.debug("Detailed debug information")
logger.info("General information")
logger.warning("Warning messages")
logger.error("Error messages")
logger.exception("Error with stack trace")
logger.critical("Critical errors")
```

### Contextual Logging:

```python
logger.info(
    f"User action completed",
    extra={
        "user_id": user_id,
        "action": "download_model",
        "model_id": model_id,
        "duration_ms": 1234
    }
)
```

### Log Files:

- `logs/app.log`: All application logs (DEBUG and above)
- `logs/error.log`: Error logs only (ERROR and above)

---

## Frontend Error Handling

### ErrorBoundary Component

React Error Boundary to catch and handle rendering errors:

```tsx
import { ErrorBoundary } from '@/ui/components/ErrorBoundary';

// Basic usage
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>

// With custom fallback
<ErrorBoundary fallback={(error, errorInfo, reset) => (
  <div>
    <h1>Something went wrong</h1>
    <p>{error.message}</p>
    <button onClick={reset}>Try again</button>
  </div>
)}>
  <YourComponent />
</ErrorBoundary>

// As HOC
const SafeComponent = withErrorBoundary(MyComponent);
```

### Features:

- Catches React rendering errors
- Provides default error UI
- Shows detailed error info in development mode
- Supports custom fallback UI
- Includes "Try Again" and "Refresh Page" actions

### ErrorHandler Utility

Centralized error handling utility:

```typescript
import { ErrorHandler } from '@/utils/errorHandler';

// Show error toast
ErrorHandler.showError("Something went wrong");
ErrorHandler.showError(error, "Context");

// Handle API errors
try {
  await fetchData();
} catch (error) {
  const message = ErrorHandler.handleApiError(error);
  ErrorHandler.showError(message);
}

// Show success/info/warning
ErrorHandler.showSuccess("Operation completed!");
ErrorHandler.showInfo("Processing...");
ErrorHandler.showWarning("Please save your work");

// Loading states
const toastId = ErrorHandler.showLoading("Downloading...");
ErrorHandler.updateToSuccess(toastId, "Download complete!");
ErrorHandler.updateToError(toastId, "Download failed");

// Error with retry button
ErrorHandler.createRetryMessage(
  "Failed to load data",
  () => refetch()
);

// Log errors (development only)
ErrorHandler.logError(error, "ComponentName");
```

### useErrorHandler Hook

React hook for error handling:

```typescript
import { useErrorHandler } from '@/hooks/useErrorHandler';

function MyComponent() {
  const { 
    handleError, 
    handleErrorWithRetry,
    handleSuccess,
    handleWarning 
  } = useErrorHandler('MyComponent');

  const fetchData = async () => {
    try {
      const data = await api.fetchData();
      handleSuccess("Data loaded successfully!");
      return data;
    } catch (error) {
      handleError(error);
    }
  };

  const fetchWithRetry = async () => {
    try {
      const data = await api.fetchData();
      return data;
    } catch (error) {
      handleErrorWithRetry(error, fetchWithRetry);
    }
  };

  return <div>...</div>;
}
```

---

## Retry Logic

### Backend Retry Logic

The backend includes a comprehensive retry utility in `app/utils/retry.py`:

```python
from app.utils.retry import retry_async, RetryConfig

# Basic usage
result = await retry_async(
    some_async_function,
    arg1,
    arg2,
    config=RetryConfig(max_attempts=3, initial_delay=1.0),
    retryable_exceptions=(ConnectionError, TimeoutError)
)

# As decorator
from app.utils.retry import retry_async_decorator

@retry_async_decorator(
    config=RetryConfig(max_attempts=3),
    retryable_exceptions=(httpx.ConnectError, httpx.TimeoutException)
)
async def fetch_external_data():
    # ... implementation
    pass
```

#### Features:

- Exponential backoff with jitter
- Configurable max attempts and delays
- Selective exception retry
- Callback support for retry events
- Comprehensive logging

#### Configuration:

```python
RetryConfig(
    max_attempts=3,           # Maximum retry attempts
    initial_delay=1.0,        # Initial delay in seconds
    max_delay=60.0,          # Maximum delay in seconds
    exponential_base=2.0,    # Base for exponential backoff
    jitter=True              # Add random jitter
)
```

### Frontend Retry Logic

The frontend includes automatic retry logic for API requests:

#### Axios Interceptor

Configured in `services/api.ts`:

- Automatically retries on network errors and specific HTTP status codes (408, 429, 500, 502, 503, 504)
- Exponential backoff with jitter
- Default: 3 retry attempts
- Logs retry attempts to console

#### React Query Retry

Configured in `main.tsx`:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,  // Retry failed queries twice
      retryDelay: (attemptIndex) => 
        Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
    mutations: {
      retry: 1,  // Retry failed mutations once
      retryDelay: 1000,
    },
  },
});
```

---

## Best Practices

### Backend

1. **Always use structured logging**:
   ```python
   logger.info(f"Action completed", extra={
       "user_id": user_id,
       "duration": duration,
       "status": "success"
   })
   ```

2. **Use appropriate exception types**:
   ```python
   # Good
   raise NotFoundError(f"Model {model_id} not found")
   
   # Avoid
   raise Exception("Model not found")
   ```

3. **Log before raising exceptions**:
   ```python
   logger.error(f"Failed to load model: {e}")
   raise ModelError(f"Failed to load model: {str(e)}")
   ```

4. **Include context in exceptions**:
   ```python
   raise ExecutorError(
       "Failed to execute task",
       details={
           "executor": executor_name,
           "task_id": task_id,
           "parameters": parameters
       }
   )
   ```

5. **Use retry logic for external services**:
   ```python
   await retry_async(
       external_api_call,
       config=RetryConfig(max_attempts=3),
       retryable_exceptions=(httpx.ConnectError, httpx.TimeoutException)
   )
   ```

### Frontend

1. **Wrap components in ErrorBoundary**:
   ```tsx
   <ErrorBoundary>
     <YourFeature />
   </ErrorBoundary>
   ```

2. **Use useErrorHandler hook consistently**:
   ```typescript
   const { handleError, handleSuccess } = useErrorHandler('ComponentName');
   ```

3. **Provide user-friendly error messages**:
   ```typescript
   try {
     await action();
   } catch (error) {
     handleError(error, "Failed to complete action. Please try again.");
   }
   ```

4. **Use retry for critical operations**:
   ```typescript
   handleErrorWithRetry(error, () => refetch());
   ```

5. **Log errors in development**:
   ```typescript
   ErrorHandler.logError(error, 'ComponentName');
   ```

6. **Show loading states**:
   ```typescript
   const toastId = handleLoading("Processing...");
   try {
     await action();
     updateToSuccess(toastId, "Success!");
   } catch (error) {
     updateToError(toastId, "Failed");
   }
   ```

---

## Testing Error Handling

### Backend Testing

```python
import pytest
from app.core.exceptions import NotFoundError

def test_error_handling():
    with pytest.raises(NotFoundError) as exc_info:
        raise NotFoundError("Resource not found", details={"id": "123"})
    
    assert exc_info.value.status_code == 404
    assert "Resource not found" in str(exc_info.value)
```

### Frontend Testing

```typescript
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/ui/components/ErrorBoundary';

test('ErrorBoundary catches errors', () => {
  const ThrowError = () => {
    throw new Error('Test error');
  };

  render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  );

  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
});
```

---

## Configuration

### Backend Environment Variables

Add to `.env`:

```bash
DEBUG=true  # Enable debug logging
```

### Frontend Environment Variables

Add to `.env`:

```bash
VITE_API_BASE_URL=http://localhost:8000/api/v1
NODE_ENV=development  # Shows detailed errors in ErrorBoundary
```

---

## Troubleshooting

### Backend

**Issue**: Logs not appearing
- Check that `setup_logging()` is called in `main.py`
- Verify `logs/` directory exists
- Check file permissions

**Issue**: Errors not being caught
- Ensure middleware is added: `app.add_middleware(ErrorHandlingMiddleware)`
- Check middleware order (should be added before CORS)

### Frontend

**Issue**: ErrorBoundary not catching errors
- ErrorBoundary only catches rendering errors
- Use try-catch for async errors
- Ensure component is wrapped in ErrorBoundary

**Issue**: Toast notifications not showing
- Verify `<Toaster />` is rendered in app
- Check that `react-hot-toast` is installed
- Verify CSS is imported

---

## Summary

This comprehensive error handling and logging system provides:

✅ **Backend**:
- Structured logging with loguru
- Custom exception types
- Error handling middleware
- Request/response logging
- Retry logic for external services

✅ **Frontend**:
- React ErrorBoundary component
- Centralized error handler utility
- Toast notifications
- Automatic API retry logic
- React Query retry configuration
- Development-friendly error logging

All components work together to provide a robust, user-friendly error handling experience while maintaining detailed logs for debugging and monitoring.
