"""Pydantic schemas for reusable experiment presets."""

from typing import Optional

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



class PresetBase(BaseModel):
    """Base fields for an experiment preset."""
    name: str = Field(..., description="Display name of the preset")
    description: Optional[str] = Field(default="", description="Detailed description of the preset")
    chemicalFormulas: str = Field(..., description="Composition / formula range, e.g. 'Ti2O4 - Ti4O8'")
    minAtoms: int = Field(default=1, description="Minimum number of atoms")
    maxAtoms: int = Field(default=20, description="Maximum number of atoms")
    numInitial: int = Field(default=20, description="Initial random population count")
    popSize: int = Field(default=20, description="Parents pool size")
    maxNumStructures: int = Field(default=100, description="Max total structures to generate")
    optimizer: str = Field(default="gulp", description="Optimizer engine (gulp, vasp, pwscf, etc.)")
    directRunCommand: str = Field(default="gulp", description="Executable run command for direct queue")
    ginTemplate: str = Field(..., description="Monospace GULP input deck template")
    referenceEnergies: Optional[str] = Field(default=None, description="Elemental reference energies for variable composition")


class PresetCreate(PresetBase):
    """Request model for creating a preset."""
    id: Optional[str] = Field(default=None, description="Optional custom slug ID (auto-generated if omitted)")


class PresetUpdate(BaseModel):
    """Request model for updating an existing preset."""
    name: Optional[str] = None
    description: Optional[str] = None
    chemicalFormulas: Optional[str] = None
    minAtoms: Optional[int] = None
    maxAtoms: Optional[int] = None
    numInitial: Optional[int] = None
    popSize: Optional[int] = None
    maxNumStructures: Optional[int] = None
    optimizer: Optional[str] = None
    directRunCommand: Optional[str] = None
    ginTemplate: Optional[str] = None
    referenceEnergies: Optional[str] = None


class PresetResponse(PresetBase):
    """Preset model with required ID and timestamps."""
    id: str = Field(..., description="Unique slug ID of the preset")
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
