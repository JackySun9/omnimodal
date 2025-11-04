"""
Retry logic utilities for handling transient failures.
"""
import asyncio
from functools import wraps
from typing import Any, Callable, Optional, Tuple, Type, TypeVar

from loguru import logger

T = TypeVar("T")


class RetryConfig:
    """Configuration for retry behavior."""
    
    def __init__(
        self,
        max_attempts: int = 3,
        initial_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        jitter: bool = True,
    ):
        """
        Initialize retry configuration.
        
        Args:
            max_attempts: Maximum number of retry attempts
            initial_delay: Initial delay in seconds before first retry
            max_delay: Maximum delay in seconds between retries
            exponential_base: Base for exponential backoff
            jitter: Whether to add random jitter to delay
        """
        self.max_attempts = max_attempts
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter
    
    def get_delay(self, attempt: int) -> float:
        """
        Calculate delay for the given attempt number.
        
        Args:
            attempt: Current attempt number (1-based)
            
        Returns:
            Delay in seconds
        """
        import random
        
        delay = min(
            self.initial_delay * (self.exponential_base ** (attempt - 1)),
            self.max_delay
        )
        
        if self.jitter:
            # Add jitter: random value between 0 and delay
            delay = delay * (0.5 + random.random() * 0.5)
        
        return delay


async def retry_async(
    func: Callable[..., T],
    *args: Any,
    config: Optional[RetryConfig] = None,
    retryable_exceptions: Tuple[Type[Exception], ...] = (Exception,),
    on_retry: Optional[Callable[[Exception, int], None]] = None,
    **kwargs: Any,
) -> T:
    """
    Retry an async function with exponential backoff.
    
    Args:
        func: Async function to retry
        *args: Positional arguments for the function
        config: Retry configuration (uses defaults if not provided)
        retryable_exceptions: Tuple of exception types that should trigger a retry
        on_retry: Optional callback called before each retry with (exception, attempt)
        **kwargs: Keyword arguments for the function
        
    Returns:
        Result from the function
        
    Raises:
        Last exception if all retries failed
    """
    if config is None:
        config = RetryConfig()
    
    last_exception: Optional[Exception] = None
    
    for attempt in range(1, config.max_attempts + 1):
        try:
            return await func(*args, **kwargs)
        except retryable_exceptions as e:
            last_exception = e
            
            if attempt == config.max_attempts:
                logger.error(
                    f"All {config.max_attempts} retry attempts failed for {func.__name__}",
                    extra={"function": func.__name__, "error": str(e)}
                )
                raise
            
            delay = config.get_delay(attempt)
            
            logger.warning(
                f"Attempt {attempt}/{config.max_attempts} failed for {func.__name__}: {str(e)}. "
                f"Retrying in {delay:.2f}s...",
                extra={
                    "function": func.__name__,
                    "attempt": attempt,
                    "max_attempts": config.max_attempts,
                    "delay": delay,
                    "error": str(e),
                }
            )
            
            if on_retry:
                on_retry(e, attempt)
            
            await asyncio.sleep(delay)
    
    # This should never be reached, but just in case
    if last_exception:
        raise last_exception
    raise RuntimeError(f"Retry failed for {func.__name__}")


def retry_async_decorator(
    config: Optional[RetryConfig] = None,
    retryable_exceptions: Tuple[Type[Exception], ...] = (Exception,),
):
    """
    Decorator for retrying async functions.
    
    Args:
        config: Retry configuration
        retryable_exceptions: Tuple of exception types that should trigger a retry
        
    Returns:
        Decorated function
        
    Example:
        @retry_async_decorator(config=RetryConfig(max_attempts=3))
        async def fetch_data():
            # ... implementation
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            return await retry_async(
                func,
                *args,
                config=config,
                retryable_exceptions=retryable_exceptions,
                **kwargs,
            )
        return wrapper
    return decorator


def retry_sync(
    func: Callable[..., T],
    *args: Any,
    config: Optional[RetryConfig] = None,
    retryable_exceptions: Tuple[Type[Exception], ...] = (Exception,),
    on_retry: Optional[Callable[[Exception, int], None]] = None,
    **kwargs: Any,
) -> T:
    """
    Retry a synchronous function with exponential backoff.
    
    Args:
        func: Function to retry
        *args: Positional arguments for the function
        config: Retry configuration (uses defaults if not provided)
        retryable_exceptions: Tuple of exception types that should trigger a retry
        on_retry: Optional callback called before each retry with (exception, attempt)
        **kwargs: Keyword arguments for the function
        
    Returns:
        Result from the function
        
    Raises:
        Last exception if all retries failed
    """
    import time
    
    if config is None:
        config = RetryConfig()
    
    last_exception: Optional[Exception] = None
    
    for attempt in range(1, config.max_attempts + 1):
        try:
            return func(*args, **kwargs)
        except retryable_exceptions as e:
            last_exception = e
            
            if attempt == config.max_attempts:
                logger.error(
                    f"All {config.max_attempts} retry attempts failed for {func.__name__}",
                    extra={"function": func.__name__, "error": str(e)}
                )
                raise
            
            delay = config.get_delay(attempt)
            
            logger.warning(
                f"Attempt {attempt}/{config.max_attempts} failed for {func.__name__}: {str(e)}. "
                f"Retrying in {delay:.2f}s...",
                extra={
                    "function": func.__name__,
                    "attempt": attempt,
                    "max_attempts": config.max_attempts,
                    "delay": delay,
                    "error": str(e),
                }
            )
            
            if on_retry:
                on_retry(e, attempt)
            
            time.sleep(delay)
    
    # This should never be reached, but just in case
    if last_exception:
        raise last_exception
    raise RuntimeError(f"Retry failed for {func.__name__}")
