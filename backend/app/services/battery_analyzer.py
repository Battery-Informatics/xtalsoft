"""Battery, crystallography, and XRD diffraction post-processing service for XtalOpt.

Uses pymatgen and spglib with robust pure-Python fallbacks to provide:
- Standardized primitive and conventional CIF strings + POSCAR export
- Space group, crystal system, and lattice metrics
- Nearest-neighbor coordination and Li-O / TM-O bond length distributions
- Theoretical powder XRD pattern (Cu Kα radiation, 2θ in 10° - 80°)
- Theoretical gravimetric capacity (mAh/g) based on extractable Li and molar mass
"""

from math import sqrt, sin, cos, acos, degrees, radians, pi, asin
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Set
import logging
import re

from ...config import settings
from ..schemas.analysis_schema import (
    BondLengthStats,
    CoordinationSite,
    XRDPak,
    BatteryMetrics,
    StructureAnalysisResult,
)
from ..schemas.structure_schema import SpaceGroupInfo, LatticeParameters, AtomSite
from .structure_parser import (
    parse_structure_folder,
    compute_lattice_params,
    cartesian_to_fractional,
    element_for_z,
    invert_3x3,
    generate_cif_fallback,
    APPROX_ATOMIC_WEIGHTS,
    ATOMIC_SYMBOLS,
)

logger = logging.getLogger(__name__)

# Cu K-alpha wavelength in Angstroms
CU_K_ALPHA = 1.54184

# Faraday constant / 3.6 (converts C/mol to mAh/mol)
FARADAY_MAH_PER_MOL = 26801.483

# Common transition metals in battery chemistry
TRANSITION_METALS: Set[str] = {
    "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn",
    "Y", "Zr", "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd",
    "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au"
}

CRYSTAL_SYSTEMS = [
    (1, 2, "Triclinic"),
    (3, 15, "Monoclinic"),
    (16, 74, "Orthorhombic"),
    (75, 142, "Tetragonal"),
    (143, 167, "Trigonal"),
    (168, 194, "Hexagonal"),
    (195, 230, "Cubic"),
]


def get_crystal_system(spg_number: int) -> str:
    """Return crystal system from international space group number 1-230."""
    for low, high, name in CRYSTAL_SYSTEMS:
        if low <= spg_number <= high:
            return name
    return "Triclinic"


def minimum_image_distance(
    u1: List[float],
    u2: List[float],
    matrix: List[List[float]],
) -> float:
    """Compute shortest Cartesian distance between two fractional points using periodic boundary conditions."""
    du = [u1[0] - u2[0], u1[1] - u2[1], u1[2] - u2[2]]
    # Minimum image: shift into [-0.5, 0.5]
    du = [d - round(d) for d in du]
    # Cartesian vector: du * matrix
    dx = du[0] * matrix[0][0] + du[1] * matrix[1][0] + du[2] * matrix[2][0]
    dy = du[0] * matrix[0][1] + du[1] * matrix[1][1] + du[2] * matrix[2][1]
    dz = du[0] * matrix[0][2] + du[1] * matrix[1][2] + du[2] * matrix[2][2]
    return sqrt(dx * dx + dy * dy + dz * dz)


def compute_bond_and_coordination_analysis(
    matrix: List[List[float]],
    atoms: List[AtomSite],
    cutoff: float = 3.2,
) -> Tuple[List[BondLengthStats], List[CoordinationSite]]:
    """Calculate interatomic distances, Li-O / TM-O bond statistics, and coordination spheres."""
    pair_distances: Dict[str, List[float]] = {}
    coordination_sites: List[CoordinationSite] = []

    num_atoms = len(atoms)
    for i in range(num_atoms):
        a1 = atoms[i]
        elem1 = a1.element
        is_cation = (elem1 in ("Li", "Na", "K", "Mg") or elem1 in TRANSITION_METALS)

        coordinating_elems: Dict[str, int] = {}
        coord_distances: List[float] = []

        # Coordination cutoff: 2.7 Å for Li-O, 2.5 Å for TM-O, 3.0 Å general
        coord_cutoff = 2.7 if elem1 in ("Li", "Na") else 2.55 if elem1 in TRANSITION_METALS else 2.6

        for j in range(num_atoms):
            if i == j:
                continue
            a2 = atoms[j]
            elem2 = a2.element

            d = minimum_image_distance(a1.frac_coords, a2.frac_coords, matrix)
            if d <= cutoff and d > 0.05:
                # Standardize pair key: cation first or alphabetical
                if elem1 in TRANSITION_METALS or elem1 in ("Li", "Na", "K", "Mg"):
                    pair_key = f"{elem1}-{elem2}"
                elif elem2 in TRANSITION_METALS or elem2 in ("Li", "Na", "K", "Mg"):
                    pair_key = f"{elem2}-{elem1}"
                else:
                    pair_key = f"{min(elem1, elem2)}-{max(elem1, elem2)}"

                # Only register unordered pairs once for overall pair statistics
                if i < j:
                    if pair_key not in pair_distances:
                        pair_distances[pair_key] = []
                    pair_distances[pair_key].append(d)

                # Coordination check for cation with anions (e.g. O, F, S)
                if is_cation and (elem2 in ("O", "S", "F", "Cl", "N")) and d <= coord_cutoff:
                    coordinating_elems[elem2] = coordinating_elems.get(elem2, 0) + 1
                    coord_distances.append(d)

        if is_cation and coord_distances:
            coordination_sites.append(
                CoordinationSite(
                    index=i,
                    element=elem1,
                    label=a1.label or f"{elem1}{i+1}",
                    coordination_number=len(coord_distances),
                    coordinating_elements=coordinating_elems,
                    mean_distance=round(sum(coord_distances) / len(coord_distances), 4),
                )
            )

    # Compile bond statistics
    bond_stats: List[BondLengthStats] = []
    for pair, dists in pair_distances.items():
        if not dists:
            continue
        bond_stats.append(
            BondLengthStats(
                pair=pair,
                min_dist=round(min(dists), 4),
                max_dist=round(max(dists), 4),
                mean_dist=round(sum(dists) / len(dists), 4),
                count=len(dists),
            )
        )

    # Sort bond stats: Li-O and TM-O first, then by count descending
    def bond_sort_key(b: BondLengthStats):
        if "Li-O" in b.pair:
            return (0, -b.count)
        if any(f"{tm}-O" in b.pair for tm in TRANSITION_METALS):
            return (1, -b.count)
        return (2, -b.count)

    bond_stats.sort(key=bond_sort_key)
    return bond_stats, coordination_sites


def compute_theoretical_battery_capacity(
    composition: Dict[str, int],
    formula: str,
) -> BatteryMetrics:
    """Calculate theoretical gravimetric capacity (mAh/g) for Li-ion battery cathode/anode."""
    total_mass = sum(
        count * APPROX_ATOMIC_WEIGHTS.get(elem, 1.0)
        for elem, count in composition.items()
    )
    if total_mass <= 0:
        total_mass = 1.0

    num_li = composition.get("Li", 0)
    tm_count = sum(composition.get(tm, 0) for tm in TRANSITION_METALS)

    # Extractable capacity: all formula Li deintercalated
    theoretical_capacity = (num_li * FARADAY_MAH_PER_MOL) / total_mass if num_li > 0 else 0.0

    # Insertion capacity: assuming 1 electron per TM (e.g. for TiO2, V2O5, etc.)
    insertion_capacity = (tm_count * FARADAY_MAH_PER_MOL) / total_mass if tm_count > 0 else None

    # Informational notes
    notes = []
    if num_li > 0 and tm_count > 0:
        notes.append(f"Lithium transition-metal cathode material ({num_li} Li / {tm_count} TM)")
    elif num_li > 0:
        notes.append(f"Lithium-containing host material ({num_li} Li)")
    elif tm_count > 0:
        notes.append(f"Lithium-free host candidate; theoretical Li-insertion capacity: {insertion_capacity:.1f} mAh/g")
    else:
        notes.append("Non-battery or light-element composition")

    return BatteryMetrics(
        formula=formula,
        molar_mass=round(total_mass, 4),
        num_li=num_li,
        theoretical_capacity_mah_g=round(theoretical_capacity, 2),
        theoretical_insertion_capacity_mah_g=round(insertion_capacity, 2) if insertion_capacity else None,
        notes="; ".join(notes),
    )


def generate_poscar_fallback(
    matrix: List[List[float]],
    atoms: List[AtomSite],
    comment: str = "XtalOpt relaxed structure",
) -> str:
    """Generate standardized VASP POSCAR format string."""
    # Group atoms by species
    elem_order: List[str] = []
    elem_atoms: Dict[str, List[AtomSite]] = {}
    for a in atoms:
        if a.element not in elem_atoms:
            elem_order.append(a.element)
            elem_atoms[a.element] = []
        elem_atoms[a.element].append(a)

    lines = [
        comment,
        "1.0",
        f"  {matrix[0][0]:12.8f} {matrix[0][1]:12.8f} {matrix[0][2]:12.8f}",
        f"  {matrix[1][0]:12.8f} {matrix[1][1]:12.8f} {matrix[1][2]:12.8f}",
        f"  {matrix[2][0]:12.8f} {matrix[2][1]:12.8f} {matrix[2][2]:12.8f}",
        "  " + "  ".join(elem_order),
        "  " + "  ".join(str(len(elem_atoms[el])) for el in elem_order),
        "Direct",
    ]

    for el in elem_order:
        for a in elem_atoms[el]:
            u, v, w = a.frac_coords
            lines.append(f"  {u:12.8f} {v:12.8f} {w:12.8f}")

    return "\n".join(lines)


def simulate_powder_xrd(
    matrix: List[List[float]],
    atoms: List[AtomSite],
    wavelength: float = CU_K_ALPHA,
    min_two_theta: float = 10.0,
    max_two_theta: float = 80.0,
) -> List[XRDPak]:
    """Simulate powder XRD pattern using Cu Kα radiation.
    
    Tries pymatgen's XRDCalculator first; falls back to pure-Python analytical kinematic diffraction.
    """
    # 1. Try pymatgen XRDCalculator
    try:
        from pymatgen.core import Lattice, Structure
        from pymatgen.analysis.diffraction.xrd import XRDCalculator

        species = [a.element for a in atoms]
        cart_coords = [a.cart_coords for a in atoms]
        pmg_lattice = Lattice(matrix)
        pmg_struct = Structure(pmg_lattice, species, cart_coords, coords_are_cartesian=True)

        calc = XRDCalculator(wavelength="CuKa")
        pattern = calc.get_pattern(pmg_struct, two_theta_range=(min_two_theta, max_two_theta))

        peaks: List[XRDPak] = []
        max_int = max(pattern.y) if len(pattern.y) > 0 else 1.0
        if max_int <= 0:
            max_int = 1.0

        for tt, inten, hkl_list, d_val in zip(pattern.x, pattern.y, pattern.hkls, pattern.d_hkls):
            scaled_int = (inten / max_int) * 100.0
            if scaled_int >= 0.5:  # Filter minor noise peaks
                hkl_str = str(tuple(hkl_list[0]["hkl"])) if hkl_list else "(h,k,l)"
                peaks.append(
                    XRDPak(
                        two_theta=round(float(tt), 3),
                        intensity=round(float(scaled_int), 2),
                        hkl=hkl_str,
                        d_spacing=round(float(d_val), 4),
                    )
                )

        if peaks:
            return peaks
    except ImportError:
        pass
    except Exception as e:
        logger.debug("Pymatgen XRD calculator fell back: %s", e)

    # 2. Pure Python analytical Bragg powder XRD fallback
    a_vec, b_vec, c_vec = matrix[0], matrix[1], matrix[2]
    # Reciprocal lattice vectors b1, b2, b3 = 2*pi * (v2 x v3) / V
    def cross(u, v):
        return [u[1]*v[2] - u[2]*v[1], u[2]*v[0] - u[0]*v[2], u[0]*v[1] - u[1]*v[0]]
    def dot(u, v):
        return sum(x*y for x, y in zip(u, v))

    vol = abs(dot(a_vec, cross(b_vec, c_vec)))
    if vol < 1e-6:
        return []

    # Reciprocal basis (in units of 1/Å)
    ra = [x / vol for x in cross(b_vec, c_vec)]
    rb = [x / vol for x in cross(c_vec, a_vec)]
    rc = [x / vol for x in cross(a_vec, b_vec)]

    raw_reflections: List[Dict[str, Any]] = []

    # Iterate Miller indices h, k, l in [-7, 7]
    limit = 7
    for h in range(-limit, limit + 1):
        for k in range(-limit, limit + 1):
            for l in range(-limit, limit + 1):
                if h == 0 and k == 0 and l == 0:
                    continue

                # Reciprocal lattice vector G = h*ra + k*rb + l*rc
                gx = h * ra[0] + k * rb[0] + l * rc[0]
                gy = h * ra[1] + k * rb[1] + l * rc[1]
                gz = h * ra[2] + k * rb[2] + l * rc[2]
                g_mag = sqrt(gx * gx + gy * gy + gz * gz)
                if g_mag < 1e-6:
                    continue

                d = 1.0 / g_mag  # d-spacing in Å
                # Bragg's law: lambda = 2 * d * sin(theta) => sin(theta) = lambda / (2*d)
                sintheta = wavelength / (2.0 * d)
                if sintheta > 0.999 or sintheta < 0.05:
                    continue

                theta = asin(sintheta)
                two_theta = degrees(2.0 * theta)
                if not (min_two_theta <= two_theta <= max_two_theta):
                    continue

                # Structure factor F = sum_j f_j * exp(2*pi*i*(h*u + k*v + l*w))
                f_real = 0.0
                f_imag = 0.0
                for a in atoms:
                    z = a.atomic_number if a.atomic_number > 0 else 8
                    phase = 2.0 * pi * (h * a.frac_coords[0] + k * a.frac_coords[1] + l * a.frac_coords[2])
                    f_real += z * cos(phase)
                    f_imag += z * sin(phase)

                f_sq = f_real * f_real + f_imag * f_imag
                if f_sq < 1e-4:
                    continue

                # Lorentz-polarization factor: (1 + cos^2(2theta)) / (sin^2(theta) * cos(theta))
                costt = cos(2.0 * theta)
                lp = (1.0 + costt * costt) / (sintheta * sintheta * cos(theta) + 1e-6)
                intensity = f_sq * lp

                raw_reflections.append({
                    "two_theta": two_theta,
                    "intensity": intensity,
                    "hkl": f"({h}, {k}, {l})",
                    "d_spacing": d,
                })

    if not raw_reflections:
        return []

    # Group close 2θ peaks within 0.15° resolution
    raw_reflections.sort(key=lambda r: r["two_theta"])
    grouped_peaks: List[Dict[str, Any]] = []

    for r in raw_reflections:
        if grouped_peaks and abs(grouped_peaks[-1]["two_theta"] - r["two_theta"]) < 0.15:
            # Combine
            grouped_peaks[-1]["intensity"] += r["intensity"]
        else:
            grouped_peaks.append(dict(r))

    max_intensity = max(p["intensity"] for p in grouped_peaks) if grouped_peaks else 1.0
    if max_intensity <= 0:
        max_intensity = 1.0

    peaks = [
        XRDPak(
            two_theta=round(p["two_theta"], 3),
            intensity=round((p["intensity"] / max_intensity) * 100.0, 2),
            hkl=p["hkl"],
            d_spacing=round(p["d_spacing"], 4),
        )
        for p in grouped_peaks
        if (p["intensity"] / max_intensity) * 100.0 >= 0.5
    ]

    return peaks


def analyze_structure_comprehensive(
    exp_id: str,
    struct_id: str,
    symprec: float = 0.01,
) -> Optional[StructureAnalysisResult]:
    """Execute complete crystallography, XRD, and battery analysis for a candidate structure."""
    # Find experiment directory
    exp_dir = settings.RUNS_DIR / exp_id
    if not exp_dir.is_dir() and (settings.BASE_DIR / exp_id).is_dir():
        exp_dir = settings.BASE_DIR / exp_id
    if not exp_dir.is_dir():
        logger.error("Experiment directory %s not found", exp_id)
        return None

    work_dir = exp_dir / "localWorkingDirectory" if (exp_dir / "localWorkingDirectory").is_dir() else exp_dir

    # Find structure subdirectory
    folder_target = None
    if "x" in struct_id:
        parts = struct_id.split("x")
        try:
            g, i = int(parts[0]), int(parts[1])
            padded = f"{g:05d}x{i:05d}"
            if (work_dir / padded).is_dir():
                folder_target = work_dir / padded
        except ValueError:
            pass

    if not folder_target:
        candidate = work_dir / struct_id
        if candidate.is_dir():
            folder_target = candidate

    if not folder_target or not folder_target.is_dir():
        logger.error("Structure directory '%s' not found in %s", struct_id, work_dir)
        return None

    # Parse structure geometry
    parsed = parse_structure_folder(folder_target, symprec=symprec)
    if not parsed or not parsed.lattice:
        logger.error("Could not parse lattice geometry for %s", struct_id)
        return None

    matrix = parsed.lattice.matrix
    atoms = parsed.atoms
    spg_num = parsed.space_group.number if parsed.space_group else 1
    spg_symbol = parsed.space_group.symbol if parsed.space_group else "P 1"
    crystal_system = get_crystal_system(spg_num)

    # 1. Pymatgen-powered standardized Primitive & Conventional CIFs and POSCAR
    cif_primitive = None
    cif_conventional = None
    cif_standardized = parsed.cif or ""
    poscar_str = ""

    try:
        from pymatgen.core import Lattice, Structure
        from pymatgen.symmetry.analyzer import SpacegroupAnalyzer
        from pymatgen.io.cif import CifWriter
        from pymatgen.io.vasp import Poscar

        species = [a.element for a in atoms]
        cart_coords = [a.cart_coords for a in atoms]
        pmg_lattice = Lattice(matrix)
        pmg_struct = Structure(pmg_lattice, species, cart_coords, coords_are_cartesian=True)

        sga = SpacegroupAnalyzer(pmg_struct, symprec=symprec)
        crystal_system = sga.get_crystal_system().capitalize()

        prim = sga.get_primitive_standard_structure()
        conv = sga.get_conventional_standard_structure()

        cif_primitive = CifWriter(prim, symprec=symprec).__str__()
        cif_conventional = CifWriter(conv, symprec=symprec).__str__()
        cif_standardized = cif_conventional or cif_primitive or cif_standardized
        poscar_str = Poscar(pmg_struct).get_str()
    except ImportError:
        pass
    except Exception as e:
        logger.debug("Pymatgen analysis details fallback: %s", e)

    # Fallback POSCAR if pymatgen was not used
    if not poscar_str:
        poscar_str = generate_poscar_fallback(
            matrix=matrix,
            atoms=atoms,
            comment=f"XtalOpt candidate {parsed.tag} ({parsed.formula})",
        )

    # 2. Nearest-Neighbor Coordination & Bond-Length Analysis
    bonds_summary, coord_sites = compute_bond_and_coordination_analysis(
        matrix=matrix,
        atoms=atoms,
        cutoff=3.4,
    )

    # 3. Powder XRD Simulation (Cu Kα)
    xrd_peaks = simulate_powder_xrd(
        matrix=matrix,
        atoms=atoms,
        wavelength=CU_K_ALPHA,
        min_two_theta=10.0,
        max_two_theta=80.0,
    )

    # 4. Battery Theoretical Capacity
    battery_metrics = compute_theoretical_battery_capacity(
        composition=parsed.composition,
        formula=parsed.formula,
    )

    return StructureAnalysisResult(
        exp_id=exp_id,
        struct_id=struct_id,
        tag=parsed.tag,
        formula=parsed.formula,
        reduced_formula=parsed.reduced_formula,
        num_atoms=parsed.num_atoms,
        space_group=parsed.space_group or SpaceGroupInfo(symbol=spg_symbol, number=spg_num),
        crystal_system=crystal_system,
        lattice=parsed.lattice,
        volume=parsed.volume,
        density=parsed.density or 0.0,
        cif_standardized=cif_standardized,
        cif_primitive=cif_primitive,
        cif_conventional=cif_conventional,
        poscar=poscar_str,
        atoms=atoms,
        bond_analysis=bonds_summary,
        coordination_summary=coord_sites,
        xrd_peaks=xrd_peaks,
        battery_metrics=battery_metrics,
    )
