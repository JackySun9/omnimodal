from __future__ import annotations

import asyncio
import subprocess
from dataclasses import dataclass
from enum import Enum
from typing import Dict, Optional

from loguru import logger


class ProcessStatus(str, Enum):
    """Status of a managed process."""

    STOPPED = "stopped"
    STARTING = "starting"
    RUNNING = "running"
    STOPPING = "stopping"
    FAILED = "failed"


@dataclass
class ProcessConfig:
    """Configuration for a managed process."""

    name: str
    command: list[str]
    port: int
    health_check_url: str
    auto_restart: bool = False
    max_restarts: int = 3
    restart_delay: float = 5.0


class ProcessManager:
    """
    Manages lifecycle of external processes (executors like Ollama, whisper.cpp, etc.).

    This service allows the main application to start, stop, and monitor
    backend services as needed, implementing a sidecar pattern.
    """

    def __init__(self) -> None:
        self._processes: Dict[str, subprocess.Popen] = {}
        self._configs: Dict[str, ProcessConfig] = {}
        self._status: Dict[str, ProcessStatus] = {}
        self._restart_counts: Dict[str, int] = {}
        self._lock = asyncio.Lock()

    def register(self, config: ProcessConfig) -> None:
        """Register a process configuration."""
        self._configs[config.name] = config
        self._status[config.name] = ProcessStatus.STOPPED
        self._restart_counts[config.name] = 0

    async def start(self, name: str) -> bool:
        """Start a registered process."""
        async with self._lock:
            config = self._configs.get(name)
            if not config:
                logger.error(f"Process {name} is not registered")
                return False

            if self._status[name] in [ProcessStatus.RUNNING, ProcessStatus.STARTING]:
                logger.warning(f"Process {name} is already {self._status[name]}")
                return True

            self._status[name] = ProcessStatus.STARTING
            logger.info(f"Starting process: {name}")

            try:
                # Start the process
                process = subprocess.Popen(
                    config.command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                )
                self._processes[name] = process

                # Wait a bit for process to initialize
                await asyncio.sleep(2.0)

                # Check if process is still running
                if process.poll() is None:
                    self._status[name] = ProcessStatus.RUNNING
                    logger.info(f"Process {name} started successfully (PID: {process.pid})")
                    return True
                else:
                    self._status[name] = ProcessStatus.FAILED
                    stdout, stderr = process.communicate()
                    logger.error(f"Process {name} failed to start: {stderr}")
                    return False

            except Exception as e:
                self._status[name] = ProcessStatus.FAILED
                logger.exception(f"Failed to start process {name}: {e}")
                return False

    async def stop(self, name: str, timeout: float = 10.0) -> bool:
        """Stop a running process."""
        async with self._lock:
            process = self._processes.get(name)
            if not process:
                logger.warning(f"Process {name} is not running")
                return True

            self._status[name] = ProcessStatus.STOPPING
            logger.info(f"Stopping process: {name}")

            try:
                # Send terminate signal
                process.terminate()

                # Wait for graceful shutdown
                try:
                    await asyncio.wait_for(
                        asyncio.to_thread(process.wait),
                        timeout=timeout,
                    )
                except asyncio.TimeoutError:
                    # Force kill if not terminated
                    logger.warning(f"Process {name} did not terminate gracefully, killing")
                    process.kill()
                    await asyncio.to_thread(process.wait)

                del self._processes[name]
                self._status[name] = ProcessStatus.STOPPED
                logger.info(f"Process {name} stopped")
                return True

            except Exception as e:
                logger.exception(f"Failed to stop process {name}: {e}")
                return False

    async def restart(self, name: str) -> bool:
        """Restart a process."""
        logger.info(f"Restarting process: {name}")
        await self.stop(name)
        await asyncio.sleep(1.0)
        return await self.start(name)

    def get_status(self, name: str) -> ProcessStatus:
        """Get the status of a process."""
        return self._status.get(name, ProcessStatus.STOPPED)

    def is_running(self, name: str) -> bool:
        """Check if a process is running."""
        process = self._processes.get(name)
        if not process:
            return False
        return process.poll() is None

    async def start_all(self) -> None:
        """Start all registered processes with auto_start enabled."""
        for name, config in self._configs.items():
            if config.auto_restart:
                await self.start(name)

    async def stop_all(self) -> None:
        """Stop all running processes."""
        process_names = list(self._processes.keys())
        for name in process_names:
            await self.stop(name)

    async def health_check(self, name: str) -> bool:
        """
        Perform health check on a process.

        This would typically make an HTTP request to the process's health endpoint.
        For now, we just check if the process is running.
        """
        return self.is_running(name)

    async def monitor_loop(self) -> None:
        """
        Background task to monitor processes and restart if needed.

        This should be run as a background task in the FastAPI application.
        """
        while True:
            await asyncio.sleep(10.0)  # Check every 10 seconds

            for name, config in self._configs.items():
                if not config.auto_restart:
                    continue

                # Check if process should be running but isn't
                if self._status[name] == ProcessStatus.RUNNING and not self.is_running(name):
                    logger.warning(f"Process {name} died unexpectedly")

                    # Check restart limit
                    if self._restart_counts[name] < config.max_restarts:
                        logger.info(f"Restarting process {name} (attempt {self._restart_counts[name] + 1})")
                        self._restart_counts[name] += 1
                        await asyncio.sleep(config.restart_delay)
                        await self.start(name)
                    else:
                        logger.error(f"Process {name} exceeded max restart attempts")
                        self._status[name] = ProcessStatus.FAILED


# Global instance
process_manager = ProcessManager()


# Register common executor processes
def register_default_executors() -> None:
    """Register default executor process configurations."""
    
    # Ollama (if not already running system-wide)
    process_manager.register(
        ProcessConfig(
            name="ollama",
            command=["ollama", "serve"],
            port=11434,
            health_check_url="http://localhost:11434/api/tags",
            auto_restart=False,  # Usually runs as system service
        )
    )

    # Note: Other executors (whisper.cpp, piper, ollama-diffuser) would need
    # to be registered here with their specific startup commands.
    # These commands depend on how these services are installed/deployed.
