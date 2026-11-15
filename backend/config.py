"""Configuration settings for XtalOpt Web Workbench backend.

Provides configurable paths for the XtalOpt binary, runs directory,
and application server parameters. Can be configured via environment variables
or a .env file.
"""

from pathlib import Path
from typing import Optional
import os

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
except ImportError:
    # Lightweight fallback if pydantic-settings is not yet installed
    class BaseSettings:  # type: ignore
        def __init__(self, **data):
            for k, v in data.items():
                setattr(self, k, v)
    SettingsConfigDict = None  # type: ignore


# Workspace base directory (one level up from backend)
BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Application settings with environment variable overrides."""

    # Application info
    PROJECT_NAME: str = "XtalOpt Web Workbench"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api"

    # Server settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")

    # XtalOpt binary path (defaults to looking inside workspace XtalOpt/bin/xtalopt)
    XTALOPT_BIN_PATH: Path = Path(
        os.getenv(
            "XTALOPT_BIN_PATH",
            str(BASE_DIR / "XtalOpt" / "bin" / "xtalopt")
        )
    )

    # GULP binary path
    GULP_BIN_PATH: str = os.getenv("GULP_BIN_PATH", "gulp")

    # Workspace directory where isolated experiment runs are stored
    RUNS_DIR: Path = Path(
        os.getenv(
            "RUNS_DIR",
            str(BASE_DIR / "runs")
        )
    )

    # Subprocess execution timeout in seconds (default: none / unlimited for EA search)
    DEFAULT_RUN_TIMEOUT_SECONDS: Optional[int] = None

    if SettingsConfigDict:
        model_config = SettingsConfigDict(
            env_file=str(BASE_DIR / ".env"),
            env_file_encoding="utf-8",
            extra="ignore",
        )


settings = Settings()

# Ensure runs directory exists
settings.RUNS_DIR.mkdir(parents=True, exist_ok=True)

