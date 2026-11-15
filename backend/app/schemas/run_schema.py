"""Pydantic schemas for experiments and run lifecycle."""

from datetime import datetime
from typing import Optional, List, Dict, Any

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

    def Field(default=None, default_factory=None, description=None, **kwargs):  # type: ignore
        if default_factory is not None:
            return default_factory()
        return default


class ExperimentCreateRequest(BaseModel):
    """Payload to create and launch an experiment run."""
    exp_id: Optional[str] = Field(default=None, description="Unique alphanumeric identifier (auto-generated if omitted)")
    name: Optional[str] = Field(default=None, description="Human readable label for the experiment")
    description: Optional[str] = Field(default="", description="Experiment notes or description")
    chemicalFormulas: str = Field(..., description="Chemical formula range e.g. 'Ti2O4 - Ti4O8'")
    minAtoms: int = Field(default=1, description="Minimum number of atoms")
    maxAtoms: int = Field(default=20, description="Maximum number of atoms")
    numInitial: int = Field(default=20, description="Initial random structures")
    parentsPoolSize: int = Field(default=20, description="Parents pool size")
    maxNumStructures: int = Field(default=100, description="Max structures to produce")
    optimizer: str = Field(default="gulp", description="Optimizer engine")
    directRunCommand: str = Field(default="gulp", description="Direct run command")
    ginTemplate: str = Field(..., description="GULP template text")
    referenceEnergies: Optional[str] = Field(default=None, description="Reference energies for VC search")
    start_immediately: bool = Field(default=False, description="Whether to spawn ./bin/xtalopt --cli immediately")


class ExperimentItem(BaseModel):
    """Summary of an experiment run loaded from runs/<exp_id>/meta.json."""
    exp_id: str
    name: str
    status: str
    pid: Optional[int] = None
    created_at: Optional[str] = None
    chemicalFormulas: Optional[str] = None
    optimizer: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class RunCreateRequest(BaseModel):
    """Request payload to create a new experiment workspace and configure it."""
    exp_id: str = Field(..., description="Unique alphanumeric identifier for the experiment run")


class RunStatusResponse(BaseModel):
    """Process execution status response."""
    exp_id: str
    status: str = Field(..., description="Status: idle, running, completed, failed, stopped")
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
