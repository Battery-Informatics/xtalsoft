"""Pydantic schemas for parsed crystal structures and JSON metadata."""

from typing import List, Optional, Dict, Any

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


class SpaceGroupInfo(BaseModel):
    """Space group symmetry information."""

    symbol: str = Field(..., description="International space group Hermann-Mauguin symbol (e.g. 'P4_2/mnm')")
    number: int = Field(..., description="International space group number 1-230")
    hall_symbol: Optional[str] = Field(default=None, description="Hall symbol")


class LatticeParameters(BaseModel):
    """Lattice geometry parameters."""

    a: float = Field(..., description="Lattice vector length a (Angstroms)")
    b: float = Field(..., description="Lattice vector length b (Angstroms)")
    c: float = Field(..., description="Lattice vector length c (Angstroms)")
    alpha: float = Field(..., description="Lattice angle alpha (Degrees)")
    beta: float = Field(..., description="Lattice angle beta (Degrees)")
    gamma: float = Field(..., description="Lattice angle gamma (Degrees)")
    volume: float = Field(..., description="Unit cell volume (Angstroms^3)")
    matrix: List[List[float]] = Field(..., description="3x3 Cartesian lattice vectors [a, b, c]")


class AtomSite(BaseModel):
    """Atomic site in the crystal structure."""

    element: str = Field(..., description="Element symbol, e.g. 'Ti', 'O'")
    atomic_number: int = Field(..., description="Atomic number Z")
    cart_coords: List[float] = Field(..., description="Cartesian coordinates [x, y, z] in Angstroms")
    frac_coords: List[float] = Field(..., description="Fractional coordinates [u, v, w]")
    label: Optional[str] = None


class ParsedStructure(BaseModel):
    """Complete metadata and standardized CIF for a crystal structure."""

    tag: str = Field(..., description="Structure tag, e.g. '1x1' or '00001x00001'")
    dir_name: str = Field(..., description="Directory folder name, e.g. '00001x00001'")
    generation: int = Field(..., description="Generation number")
    id_number: int = Field(..., description="Structure ID within generation")
    index: int = Field(..., description="Global structure index")
    rank: Optional[int] = Field(default=None, description="Current rank in population")

    # Formula and chemistry
    formula: str = Field(..., description="Chemical formula, e.g. 'Ti2O4'")
    reduced_formula: str = Field(..., description="Reduced chemical formula, e.g. 'TiO2'")
    num_atoms: int = Field(..., description="Total number of atoms in unit cell")
    composition: Dict[str, int] = Field(default_factory=dict, description="Elemental stoichiometry breakdown")

    # Energies and thermodynamics
    energy: Optional[float] = Field(default=None, description="Total energy (eV)")
    enthalpy: Optional[float] = Field(default=None, description="Total enthalpy (eV)")
    enthalpy_per_atom: Optional[float] = Field(default=None, description="Enthalpy per atom (eV/atom)")
    dist_above_hull: Optional[float] = Field(default=None, description="Distance above convex hull (eV/atom)")
    pareto_front: Optional[int] = Field(default=None, description="Pareto front index")

    # Geometric properties
    volume: float = Field(..., description="Unit cell volume (Angstroms^3)")
    volume_per_atom: float = Field(..., description="Volume per atom (Angstroms^3/atom)")
    density: Optional[float] = Field(default=None, description="Mass density (g/cm^3)")

    # Crystallographic info
    space_group: Optional[SpaceGroupInfo] = None
    lattice: Optional[LatticeParameters] = None
    atoms: List[AtomSite] = Field(default_factory=list)

    # Status in evolutionary run
    status: str = Field(..., description="Status e.g. 'Optimized', 'InProcess', 'Failed'")
    parents: Optional[str] = Field(default=None, description="Parent structure(s) and genetic operator lineage")

    # Standardized CIF file content
    cif: str = Field(..., description="Standardized .cif file content ready for 3Dmol.js rendering")


class ExperimentStructuresSummary(BaseModel):
    """Summary of all structures discovered in an experiment run."""

    exp_id: str
    total_structures: int
    optimized_count: int
    failed_count: int
    lowest_enthalpy_tag: Optional[str] = None
    lowest_enthalpy_per_atom: Optional[float] = None
    structures: List[ParsedStructure] = Field(default_factory=list)
