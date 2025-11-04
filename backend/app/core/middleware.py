"""
FastAPI middleware for error handling and logging.
"""
import time
import traceback
from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.exceptions import AppException


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for centralized error handling and logging.
    
    Catches all exceptions and converts them to proper HTTP responses
    with structured error messages.
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            response = await call_next(request)
            return response
        except AppException as exc:
            # Handle custom application exceptions
            logger.error(
                f"Application error: {exc.message}",
                extra={
                    "status_code": exc.status_code,
                    "details": exc.details,
                    "path": request.url.path,
                    "method": request.method,
                }
            )
            return JSONResponse(
                status_code=exc.status_code,
                content={
                    "detail": exc.message,
                    "error_type": exc.__class__.__name__,
                    "details": exc.details,
                }
            )
        except Exception as exc:
            # Handle unexpected exceptions
            logger.exception(
                f"Unexpected error: {str(exc)}",
                extra={
                    "path": request.url.path,
                    "method": request.method,
                    "traceback": traceback.format_exc(),
                }
            )
            return JSONResponse(
                status_code=500,
                content={
                    "detail": "An internal server error occurred. Please try again later.",
                    "error_type": "InternalServerError",
                }
            )


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for logging all HTTP requests and responses.
    
    Logs request details, response status, and processing time.
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        # Log request
        logger.info(
            f"Request: {request.method} {request.url.path}",
            extra={
                "method": request.method,
                "path": request.url.path,
                "query_params": dict(request.query_params),
                "client_host": request.client.host if request.client else None,
            }
        )
        
        # Process request
        response = await call_next(request)
        
        # Calculate processing time
        process_time = time.time() - start_time
        
        # Log response
        log_level = "INFO" if response.status_code < 400 else "WARNING" if response.status_code < 500 else "ERROR"
        logger.log(
            log_level,
            f"Response: {response.status_code} - {request.method} {request.url.path} - {process_time:.3f}s",
            extra={
                "status_code": response.status_code,
                "process_time": process_time,
                "method": request.method,
                "path": request.url.path,
            }
        )
        
        # Add processing time to response headers
        response.headers["X-Process-Time"] = str(process_time)
        
        return response
