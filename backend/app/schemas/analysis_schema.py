"""Pydantic schemas for crystallography, XRD diffraction, and battery post-processing analysis."""

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

    def Field(default=None, default_factory=None, description=None, **kwargs) -> Any:  # type: ignore
        if default_factory is not None:
            return default_factory()
        return default

from .structure_schema import SpaceGroupInfo, LatticeParameters, AtomSite


class BondLengthStats(BaseModel):
    """Statistical summary of bond lengths for a specific atomic pair (e.g. Li-O, Ti-O)."""
    pair: str = Field(..., description="Element pair e.g. 'Li-O', 'Ni-O', 'Ti-O'")
    min_dist: float = Field(..., description="Minimum interatomic distance (Å)")
    max_dist: float = Field(..., description="Maximum interatomic distance (Å)")
    mean_dist: float = Field(..., description="Average interatomic distance (Å)")
    count: int = Field(..., description="Number of coordinating pairs observed")


class CoordinationSite(BaseModel):
    """First-coordination sphere details for a specific cation site."""
    index: int = Field(..., description="Atomic site index")
    element: str = Field(..., description="Element symbol (e.g. 'Ti', 'Li', 'Ni')")
    label: str = Field(..., description="Atom site label (e.g. 'Ti1')")
    coordination_number: int = Field(..., description="Coordination number (e.g. 6 for octahedral MO6)")
    coordinating_elements: Dict[str, int] = Field(default_factory=dict, description="Breakdown of coordinating species")
    mean_distance: float = Field(..., description="Average bond distance to coordinating ligands (Å)")


class XRDPak(BaseModel):
    """Single reflection peak in simulated powder XRD pattern."""
    two_theta: float = Field(..., description="Diffraction angle 2θ in degrees (Cu Kα)")
    intensity: float = Field(..., description="Relative peak intensity (0 - 100)")
    hkl: str = Field(..., description="Miller indices e.g. '(1, 0, 4)'")
    d_spacing: float = Field(..., description="Lattice plane d-spacing (Å)")


class BatteryMetrics(BaseModel):
    """Thermodynamic and electrochemical capacity metrics for battery cathode/anode analysis."""
    formula: str = Field(..., description="Reduced or stoichiometric formula")
    molar_mass: float = Field(..., description="Molar mass in g/mol")
    num_li: int = Field(default=0, description="Number of extractable Li atoms per formula unit")
    theoretical_capacity_mah_g: float = Field(
        default=0.0,
        description="Theoretical gravimetric capacity for full Li deintercalation (mAh/g)"
    )
    theoretical_insertion_capacity_mah_g: Optional[float] = Field(
        default=None,
        description="Theoretical capacity assuming single-electron reduction per TM (mAh/g)"
    )
    notes: Optional[str] = Field(default=None, description="Analysis notes or cathode classification")


class StructureAnalysisResult(BaseModel):
    """Complete crystallography, battery metrics, and simulated XRD diffraction output."""
    exp_id: str
    struct_id: str
    tag: str
    formula: str
    reduced_formula: str
    num_atoms: int
    space_group: SpaceGroupInfo
    crystal_system: str = Field(default="Triclinic", description="Crystal system e.g. Tetragonal, Cubic, Trigonal")
    lattice: LatticeParameters
    volume: float
    density: float
    cif_standardized: str
    cif_primitive: Optional[str] = None
    cif_conventional: Optional[str] = None
    poscar: str
    atoms: List[AtomSite]
    bond_analysis: List[BondLengthStats]
    coordination_summary: List[CoordinationSite]
    xrd_peaks: List[XRDPak]
    battery_metrics: BatteryMetrics
