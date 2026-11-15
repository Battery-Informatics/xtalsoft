"""Pydantic schemas for XtalOpt configuration files.

Matches all keywords and defaults supported by XtalOpt v15 CLI.
"""

from typing import List, Optional, Any

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


class LatticeConstraints(BaseModel):
    """Lattice vector length and angle bounds (Angstroms and Degrees)."""

    a_min: float = Field(default=3.0, description="Min lattice length a (Angstroms)")
    b_min: float = Field(default=3.0, description="Min lattice length b (Angstroms)")
    c_min: float = Field(default=3.0, description="Min lattice length c (Angstroms)")
    a_max: float = Field(default=10.0, description="Max lattice length a (Angstroms)")
    b_max: float = Field(default=10.0, description="Max lattice length b (Angstroms)")
    c_max: float = Field(default=10.0, description="Max lattice length c (Angstroms)")

    alpha_min: float = Field(default=60.0, description="Min lattice angle alpha (Degrees)")
    beta_min: float = Field(default=60.0, description="Min lattice angle beta (Degrees)")
    gamma_min: float = Field(default=60.0, description="Min lattice angle gamma (Degrees)")
    alpha_max: float = Field(default=120.0, description="Max lattice angle alpha (Degrees)")
    beta_max: float = Field(default=120.0, description="Max lattice angle beta (Degrees)")
    gamma_max: float = Field(default=120.0, description="Max lattice angle gamma (Degrees)")


class VolumeConstraints(BaseModel):
    """Volume limits for generated unit cells."""

    min_volume: float = Field(default=1.0, description="Min volume per atom (Angstroms^3)")
    max_volume: float = Field(default=100.0, description="Max volume per atom (Angstroms^3)")
    min_volume_scale: float = Field(default=0.0, description="Min volume scaling factor")
    max_volume_scale: float = Field(default=0.0, description="Max volume scaling factor")
    elemental_volumes: Optional[str] = Field(
        default=None,
        description="Elemental volumes e.g. 'Ti1 30 50, O2 40 60'"
    )


class AtomicRadiiSettings(BaseModel):
    """Interatomic distance (IAD) settings to prevent atomic collisions."""

    using_scaled_iads: bool = Field(
        default=True,
        description="Ensure atoms do not overlap based on scaled covalent radii"
    )
    radii_scaling_factor: float = Field(
        default=0.5,
        description="Factor to scale covalent radii"
    )
    min_radius: float = Field(
        default=0.25,
        description="Minimum radius for any given atom (Angstroms)"
    )
    using_custom_iads: bool = Field(
        default=False,
        description="Use custom interatomic distances instead of scaled radii"
    )
    custom_iads: List[str] = Field(
        default_factory=list,
        description="List of custom IADs formatted as 'Elem1, Elem2, minIAD'"
    )
    check_iad_post_optimization: bool = Field(
        default=False,
        description="Check IADs after optimization"
    )


class SearchLimits(BaseModel):
    """Population, breeding, and structure generation parameters."""

    num_initial: int = Field(default=20, description="Number of initial random structures")
    parents_pool_size: int = Field(default=20, description="Size of parent pool")
    limit_running_jobs: bool = Field(default=True, description="Limit concurrent running jobs")
    running_job_limit: int = Field(default=1, description="Max running concurrent jobs")
    continuous_structures: int = Field(default=15, description="Keep continuous queue loaded")
    max_num_structures: int = Field(default=100, description="Max structures to generate")
    job_fail_limit: int = Field(default=1, description="Fail limit per structure")
    job_fail_action: str = Field(
        default="fail",
        description="Action on job failure: fail, keepTrying, replaceWithRandom, replaceWithOffspring"
    )
    soft_exit: bool = Field(
        default=True,
        description="Exit gracefully once max_num_structures are produced"
    )
    hard_exit: bool = Field(
        default=False,
        description="Immediate hard exit flag"
    )


class GeneticOperatorWeights(BaseModel):
    """Relative weights for evolutionary genetic operators."""

    weight_crossover: int = Field(default=20, description="Crossover operator weight")
    weight_stripple: int = Field(default=20, description="Stripple operator weight")
    weight_permustrain: int = Field(default=20, description="Permustrain operator weight")
    weight_permutomic: int = Field(default=20, description="Permutomic operator weight")
    weight_permucomp: int = Field(default=10, description="Permucomp operator weight")
    random_supercell: int = Field(default=0, description="Percent chance of supercell")

    # Stripple details
    stripple_amplitude_min: float = 0.5
    stripple_amplitude_max: float = 1.0
    stripple_num_waves_axis1: int = 1
    stripple_num_waves_axis2: int = 1
    stripple_strain_stdev_min: float = 0.5
    stripple_strain_stdev_max: float = 0.5

    # Permustrain details
    permustrain_num_exchanges: int = 4
    permustrain_strain_stdev_max: float = 0.5

    # Crossover details
    crossover_cuts: int = 1
    crossover_min_contribution: int = 25


class Tolerances(BaseModel):
    """Structure comparison and symmetry detection tolerances."""

    xtalcomp_tolerance_length: float = Field(default=0.1, description="XtalComp length tolerance (Angstroms)")
    xtalcomp_tolerance_angle: float = Field(default=2.0, description="XtalComp angle tolerance (Degrees)")
    rdf_tolerance: float = Field(default=0.98, description="Radial Distribution Function tolerance")
    rdf_cutoff: float = Field(default=6.0, description="RDF bond length cutoff (Angstroms)")
    rdf_sigma: float = Field(default=0.008, description="RDF Gaussian spread")
    rdf_num_bins: int = Field(default=3000, description="RDF bin count")
    spglib_tolerance: float = Field(default=0.01, description="Spglib symmetry tolerance")


class OptimizerSettings(BaseModel):
    """Optimizer and execution queue settings."""

    queue_interface: str = Field(default="none", description="Queue interface: none, slurm, pbs, etc.")
    optimizer: str = Field(default="gulp", description="Optimizer: gulp, vasp, pwscf, castep, siesta, mtp")
    direct_run_command: str = Field(default="gulp", description="Command executed in direct run mode")
    num_optimization_steps: int = Field(default=1, description="Number of optimization stages")
    templates_directory: str = Field(
        default="./templates/gulp",
        description="Relative or absolute path to template folder"
    )
    gin_templates: str = Field(default="gin1", description="GULP template filename(s)")
    local_working_directory: str = Field(
        default="./localWorkingDirectory",
        description="Local output directory"
    )
    log_error_directories: bool = Field(default=False, description="Log failed run dirs to errorDirs/")

    # Optional custom template content for templates/gulp/gin1
    custom_gulp_template: Optional[str] = Field(
        default=None,
        description="Custom GULP input template deck. If omitted, default force-field deck will be generated."
    )


class XtalOptExperimentConfig(BaseModel):
    """Full experiment configuration used to generate xtalopt.in and templates."""

    # Required inputs for XtalOpt
    chemical_formulas: str = Field(
        ...,
        description="Chemical formulas, e.g. 'Ti2O4 - Ti4O8' or 'Li1Fe1P1O4' or 'TiO2, Ti2O4'"
    )

    # Composition & system size limits
    min_atoms: int = Field(default=1, description="Minimum number of atoms")
    max_atoms: int = Field(default=20, description="Maximum number of atoms")
    vc_search: bool = Field(default=False, description="Variable composition search")
    reference_energies: Optional[str] = Field(
        default=None,
        description="Reference energies for VC search, e.g. 'Ti3 -14.187, O4 -10.198'"
    )

    # Symmetry constraints
    using_rand_spg: bool = Field(default=False, description="Initialize crystals with random space groups")
    forced_spgs: Optional[str] = Field(default=None, description="Comma-separated space groups, e.g. '136, 136'")

    # Sub-component configurations
    lattice: LatticeConstraints = Field(default_factory=LatticeConstraints)
    volume: VolumeConstraints = Field(default_factory=VolumeConstraints)
    radii: AtomicRadiiSettings = Field(default_factory=AtomicRadiiSettings)
    search: SearchLimits = Field(default_factory=SearchLimits)
    mutation: GeneticOperatorWeights = Field(default_factory=GeneticOperatorWeights)
    tolerances: Tolerances = Field(default_factory=Tolerances)
    optimizer_cfg: OptimizerSettings = Field(default_factory=OptimizerSettings)

    # Output options
    verbose_output: bool = False
    debug_output: bool = False
    save_hull_snapshots: bool = False
