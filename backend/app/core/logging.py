"""
Centralized logging configuration using loguru.
"""
import sys
from pathlib import Path
from loguru import logger

from app.core.config import settings


def setup_logging() -> None:
    """
    Configure loguru logger with structured logging.
    
    Features:
    - Console output with color coding
    - File rotation with size and time constraints
    - Structured logging with context
    - Different log levels for development and production
    """
    # Remove default logger
    logger.remove()
    
    # Console handler with colors
    logger.add(
        sys.stderr,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level="DEBUG" if settings.DEBUG else "INFO",
        colorize=True,
        backtrace=True,
        diagnose=True,
    )
    
    # File handler with rotation
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    logger.add(
        log_dir / "app.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        level="DEBUG",
        rotation="10 MB",  # Rotate after 10 MB
        retention="7 days",  # Keep logs for 7 days
        compression="zip",  # Compress rotated logs
        enqueue=True,  # Thread-safe logging
        backtrace=True,
        diagnose=True,
    )
    
    # Error file handler for error and above
    logger.add(
        log_dir / "error.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        level="ERROR",
        rotation="10 MB",
        retention="30 days",  # Keep error logs longer
        compression="zip",
        enqueue=True,
        backtrace=True,
        diagnose=True,
    )
    
    logger.info("Logging configured successfully")


def get_logger(name: str):
    """
    Get a logger instance with the specified name.
    
    Args:
        name: Name of the logger (usually __name__)
        
    Returns:
        Logger instance
    """
    return logger.bind(name=name)
