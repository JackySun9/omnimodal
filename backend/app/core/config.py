from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    API_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "Unified Multimodal Platform"
    DB_URL: str = "sqlite+aiosqlite:///./data.db"
    REDIS_URL: str = "redis://localhost:6379/0"
    HUGGINGFACE_TOKEN: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
