"""Pydantic schemas for live experiment telemetry and population breakdown."""

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

from .run_schema import RunStatusResponse, RunLogsResponse


class PopulationBreakdown(BaseModel):
    """Categorized breakdown of candidates generated during the search."""
    total_generated: int = Field(default=0, description="Total candidates generated")
    currently_optimizing: int = Field(default=0, description="Structures currently running in optimizer")
    queued: int = Field(default=0, description="Structures queued or submitted")
    completed_optimized: int = Field(default=0, description="Structures successfully optimized")
    duplicate: int = Field(default=0, description="Duplicate or similar structures identified")
    failed: int = Field(default=0, description="Structures that encountered optimization errors or failed constraints")
    best_enthalpy_per_atom: Optional[float] = Field(default=None, description="Lowest enthalpy per atom found so far (eV/atom)")
    best_structure_tag: Optional[str] = Field(default=None, description="Tag of best structure found so far")


class ExperimentTelemetry(BaseModel):
    """Real-time telemetry payload streamed to frontend."""
    exp_id: str
    name: Optional[str] = None
    process: RunStatusResponse
    population: PopulationBreakdown
    logs: RunLogsResponse
    updated_at: str
