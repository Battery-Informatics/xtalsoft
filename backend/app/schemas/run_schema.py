"""Pydantic schemas for run lifecycle, execution status, and logs."""

from datetime import datetime
from typing import Optional, List, Any

try:
    from pydantic import BaseModel, Field
except ImportError:
    class BaseModel:  # type: ignore
        def __init__(self, **kwargs):
            for k, v in self.__class__.__dict__.items():
                if not k.startswith('_') and not callable(v):
                    setattr(self, k, v)
            for k, v in kwargs.items():
                setattr(self, k, v)

        def model_dump(self) -> dict:
            res = {}
            for k, v in self.__dict__.items():
                if hasattr(v, 'model_dump'):
                    res[k] = v.model_dump()
                elif isinstance(v, list):
                    res[k] = [x.model_dump() if hasattr(x, 'model_dump') else x for x in v]
                else:
                    res[k] = v
            return res

    def Field(default=None, default_factory=None, description=None, **kwargs) -> Any:  # type: ignore
        if default_factory is not None:
            return default_factory()
        return default


class RunCreateRequest(BaseModel):
    """Request payload to create a new experiment workspace and configure it."""

    exp_id: str = Field(..., description="Unique alphanumeric identifier for the experiment run")


class RunStatusResponse(BaseModel):
    """Process execution status response."""

    exp_id: str
    status: str = Field(
        ...,
        description="Status: idle, running, completed, failed, stopped"
    )
    pid: Optional[int] = Field(default=None, description="System process ID")
    exit_code: Optional[int] = Field(default=None, description="Process exit code if finished")
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    elapsed_seconds: Optional[float] = None
    message: Optional[str] = None


class RunLogsResponse(BaseModel):
    """Stdout and Stderr logs captured for an experiment run."""

    exp_id: str
    stdout_lines: List[str]
    stderr_lines: List[str]
    total_stdout_lines: int
    total_stderr_lines: int
