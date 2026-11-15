"""Structure parser service for XtalOpt.

Reads `localWorkingDirectory` outputs:
- `results.txt` (evolutionary summary table)
- `structure.state` (Qt QSettings format crystal geometry and energetics)
- `xtal.got` (GULP output fallback)

Converts relaxed structures into standardized CIF strings and structured JSON metadata
using pymatgen / spglib / ase with robust fallback.
"""

from math import sqrt, acos, degrees
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import logging
import re

from ..schemas.structure_schema import (
    SpaceGroupInfo,
    LatticeParameters,
    AtomSite,
    ParsedStructure,
    ExperimentStructuresSummary,
)
from ...config import settings

logger = logging.getLogger(__name__)

# Standard element symbols by atomic number (1 to 118)
ATOMIC_SYMBOLS = [
    "", "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne",
    "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca",
    "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn",
    "Ga", "Ge", "As", "Se", "Br", "Kr", "Rb", "Sr", "Y", "Zr",
    "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd", "In", "Sn",
    "Sb", "Te", "I", "Xe", "Cs", "Ba", "La", "Ce", "Pr", "Nd",
    "Pm", "Sm", "Eu", "Gd", "Tb", "Dy", "Ho", "Er", "Tm", "Yb",
    "Lu", "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au", "Hg",
    "Tl", "Pb", "Bi", "Po", "At", "Rn", "Fr", "Ra", "Ac", "Th",
    "Pa", "U", "Np", "Pu", "Am", "Cm", "Bk", "Cf", "Es", "Fm",
    "Md", "No", "Lr", "Rf", "Db", "Sg", "Bh", "Hs", "Mt", "Ds",
    "Rg", "Cn", "Nh", "Fl", "Mc", "Lv", "Ts", "Og"
]

# Atomic weights in amu for density calculation
APPROX_ATOMIC_WEIGHTS = {
    "H": 1.008, "He": 4.0026, "Li": 6.94, "Be": 9.0122, "B": 10.81,
    "C": 12.011, "N": 14.007, "O": 15.999, "F": 18.998, "Ne": 20.180,
    "Na": 22.990, "Mg": 24.305, "Al": 26.982, "Si": 28.085, "P": 30.974,
    "S": 32.06, "Cl": 35.45, "Ar": 39.948, "K": 39.098, "Ca": 40.078,
    "Sc": 44.956, "Ti": 47.867, "V": 50.942, "Cr": 51.996, "Mn": 54.938,
    "Fe": 55.845, "Co": 58.933, "Ni": 58.693, "Cu": 63.546, "Zn": 65.38,
    "Ga": 69.723, "Ge": 72.630, "As": 74.922, "Se": 78.971, "Br": 79.904,
    "Y": 88.906, "Zr": 91.224, "Nb": 92.906, "Mo": 95.95, "Ru": 101.07,
    "Rh": 102.91, "Pd": 106.42, "Ag": 107.87, "Sn": 118.71, "Sb": 121.76,
    "Te": 127.60, "I": 126.90, "Cs": 132.91, "Ba": 137.33, "La": 138.91,
    "Ta": 180.95, "W": 183.84, "Pt": 195.08, "Au": 196.97, "Pb": 207.2,
    "Bi": 208.98,
}

# XtalOpt Structure State Enum mapping
STATE_NAMES = {
    0: "Optimized",
    1: "Checking",
    2: "Waiting",
    3: "InProcess",
    4: "Empty",
    5: "Updating",
    6: "Error",
    7: "Submitted",
    8: "Failed",
    9: "Removed",
    10: "Restart",
    11: "ScriptCalcs",
    12: "ObjcCalcs",
    13: "ConsCalcs",
    14: "Dismissed",
    15: "ObjcFailed",
    16: "ConsFailed",
}


def element_for_z(atomic_number: int) -> str:
    """Return element symbol from atomic number Z."""
    if 1 <= atomic_number < len(ATOMIC_SYMBOLS):
        return ATOMIC_SYMBOLS[atomic_number]
    return f"X{atomic_number}"


def dot_product(v1: List[float], v2: List[float]) -> float:
    return sum(a * b for a, b in zip(v1, v2))


def norm(v: List[float]) -> float:
    return sqrt(dot_product(v, v))


def cross_product(v1: List[float], v2: List[float]) -> List[float]:
    return [
        v1[1] * v2[2] - v1[2] * v2[1],
        v1[2] * v2[0] - v1[0] * v2[2],
        v1[0] * v2[1] - v1[1] * v2[0],
    ]


def determinant_3x3(m: List[List[float]]) -> float:
    return (
        m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
        - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
        + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    )


def invert_3x3(m: List[List[float]]) -> List[List[float]]:
    det = determinant_3x3(m)
    if abs(det) < 1e-12:
        raise ValueError("Singular cell matrix cannot be inverted")
    invdet = 1.0 / det
    return [
        [
            (m[1][1] * m[2][2] - m[1][2] * m[2][1]) * invdet,
            (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * invdet,
            (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * invdet,
        ],
        [
            (m[1][2] * m[2][0] - m[1][0] * m[2][2]) * invdet,
            (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * invdet,
            (m[0][2] * m[1][0] - m[0][0] * m[1][2]) * invdet,
        ],
        [
            (m[1][0] * m[2][1] - m[1][1] * m[2][0]) * invdet,
            (m[0][1] * m[2][0] - m[0][0] * m[2][1]) * invdet,
            (m[0][0] * m[1][1] - m[0][1] * m[1][0]) * invdet,
        ],
    ]


def compute_lattice_params(matrix: List[List[float]]) -> Tuple[float, float, float, float, float, float, float]:
    """Given 3x3 Cartesian lattice vectors [a, b, c], compute lengths and angles."""
    a_vec = matrix[0]
    b_vec = matrix[1]
    c_vec = matrix[2]

    a = norm(a_vec)
    b = norm(b_vec)
    c = norm(c_vec)

    if a * b == 0 or b * c == 0 or a * c == 0:
        return a, b, c, 90.0, 90.0, 90.0, 0.0

    cos_alpha = max(-1.0, min(1.0, dot_product(b_vec, c_vec) / (b * c)))
    cos_beta = max(-1.0, min(1.0, dot_product(a_vec, c_vec) / (a * c)))
    cos_gamma = max(-1.0, min(1.0, dot_product(a_vec, b_vec) / (a * b)))

    alpha = degrees(acos(cos_alpha))
    beta = degrees(acos(cos_beta))
    gamma = degrees(acos(cos_gamma))
    vol = abs(determinant_3x3(matrix))

    return a, b, c, alpha, beta, gamma, vol


def cartesian_to_fractional(cart_coords: List[float], matrix: List[List[float]]) -> List[float]:
    """Convert Cartesian coordinates to fractional coordinates."""
    # r = u*a + v*b + w*c => [u, v, w] * M = r => [u, v, w] = r * M^-1
    inv_m = invert_3x3(matrix)
    x, y, z = cart_coords
    u = x * inv_m[0][0] + y * inv_m[1][0] + z * inv_m[2][0]
    v = x * inv_m[0][1] + y * inv_m[1][1] + z * inv_m[2][1]
    w = x * inv_m[0][2] + y * inv_m[1][2] + z * inv_m[2][2]
    # Wrap coordinates into [0, 1)
    return [u % 1.0, v % 1.0, w % 1.0]


def parse_results_txt(results_path: Path) -> List[Dict[str, Any]]:
    """Parse table rows from localWorkingDirectory/results.txt.

    Columns in XtalOpt v15:
    Rank Struct Formula Compos Index EnthalpyAtm Front AbovHullAtm [Objc...] [Cons...] SG Status
    """
    if not results_path.is_file():
        return []

    entries = []
    lines = results_path.read_text(encoding="utf-8", errors="replace").splitlines()
    for line in lines:
        cleaned = line.strip()
        if not cleaned or cleaned.startswith("#"):
            continue
        tokens = cleaned.split()
        if not tokens or tokens[0] == "Rank":
            continue

        try:
            rank = int(tokens[0])
            tag = tokens[1]
            formula = tokens[2]
            compos = tokens[3]
            idx = int(tokens[4])
            enthalpy_atm = float(tokens[5])
            front = int(tokens[6])
            abov_hull = float(tokens[7])
            sg = int(tokens[-2])
            status = tokens[-1]

            entries.append({
                "rank": rank,
                "tag": tag,
                "formula": formula,
                "composition_str": compos,
                "index": idx,
                "enthalpy_per_atom": enthalpy_atm,
                "pareto_front": front,
                "dist_above_hull": abov_hull,
                "space_group_number": sg,
                "status": status,
            })
        except (ValueError, IndexError) as e:
            logger.debug("Skipping unparseable results.txt row: '%s' (%s)", cleaned, e)

    return entries


def parse_structure_state(state_path: Path) -> Optional[Dict[str, Any]]:
    """Parse Qt QSettings INI formatted structure.state file."""
    if not state_path.is_file():
        return None

    raw_text = state_path.read_text(encoding="utf-8", errors="replace")
    kv_pairs: Dict[str, str] = {}
    for line in raw_text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("["):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            # Normalize backslashes (Qt uses both / and \)
            k_norm = k.strip().replace("\\", "/")
            kv_pairs[k_norm] = v.strip()

    try:
        generation = int(kv_pairs.get("generation", 0))
        id_number = int(kv_pairs.get("id", 0))
        index = int(kv_pairs.get("index", 0))
        status_code = int(kv_pairs.get("status", 0))
        status_name = STATE_NAMES.get(status_code, f"State_{status_code}")

        # Cell matrix 3x3
        # In QSettings: current/cell/00, 01, 02, 10, 11, 12, 20, 21, 22
        cell_matrix = [
            [
                float(kv_pairs.get("current/cell/00", 10.0)),
                float(kv_pairs.get("current/cell/01", 0.0)),
                float(kv_pairs.get("current/cell/02", 0.0)),
            ],
            [
                float(kv_pairs.get("current/cell/10", 0.0)),
                float(kv_pairs.get("current/cell/11", 10.0)),
                float(kv_pairs.get("current/cell/12", 0.0)),
            ],
            [
                float(kv_pairs.get("current/cell/20", 0.0)),
                float(kv_pairs.get("current/cell/21", 0.0)),
                float(kv_pairs.get("current/cell/22", 10.0)),
            ],
        ]

        # Atomic numbers
        num_atoms = int(kv_pairs.get("current/atomicNums/size", 0))
        atomic_numbers = []
        for i in range(1, num_atoms + 1):
            key = f"current/atomicNums/{i}/value"
            if key in kv_pairs:
                atomic_numbers.append(int(kv_pairs[key]))

        # Cartesian coordinates
        num_coords = int(kv_pairs.get("current/coords/size", 0))
        coords = []
        for i in range(1, num_coords + 1):
            xk = f"current/coords/{i}/x"
            yk = f"current/coords/{i}/y"
            zk = f"current/coords/{i}/z"
            if xk in kv_pairs and yk in kv_pairs and zk in kv_pairs:
                coords.append([float(kv_pairs[xk]), float(kv_pairs[yk]), float(kv_pairs[zk])])

        energy = (
            float(kv_pairs["current/energy"])
            if "current/energy" in kv_pairs
            else None
        )
        enthalpy = (
            float(kv_pairs["current/enthalpy"])
            if "current/enthalpy" in kv_pairs
            else None
        )

        return {
            "generation": generation,
            "id_number": id_number,
            "index": index,
            "status": status_name,
            "cell_matrix": cell_matrix,
            "atomic_numbers": atomic_numbers,
            "cart_coords": coords,
            "energy": energy,
            "enthalpy": enthalpy,
        }
    except Exception as e:
        logger.error("Error parsing structure.state at %s: %s", state_path, e)
        return None


def parse_gulp_output(got_path: Path) -> Optional[Dict[str, Any]]:
    """Fallback reader for GULP xtal.got output file."""
    if not got_path.is_file():
        return None

    try:
        text = got_path.read_text(encoding="utf-8", errors="replace")
        cell_matrix = None
        atomic_numbers = []
        frac_coords = []
        energy = None

        lines = text.splitlines()
        i = 0
        while i < len(lines):
            line = lines[i]

            # Lattice energy
            if "Total lattice energy" in line and "eV" in line:
                tokens = line.split()
                for idx, t in enumerate(tokens):
                    if t == "=" and idx + 1 < len(tokens):
                        try:
                            energy = float(tokens[idx + 1])
                        except ValueError:
                            pass

            # Final Cartesian lattice vectors
            elif "Final Cartesian lattice vectors" in line:
                i += 2  # Skip blank line
                m = []
                for _ in range(3):
                    if i < len(lines):
                        row_tokens = lines[i].split()
                        m.append([float(row_tokens[0]), float(row_tokens[1]), float(row_tokens[2])])
                        i += 1
                cell_matrix = m
                continue

            # Final fractional coordinates
            elif "Final fractional coordinates of atoms" in line:
                atomic_numbers = []
                frac_coords = []
                i += 1
                # Skip header lines until we see the dashed separator
                while i < len(lines) and "------------------" not in lines[i]:
                    i += 1
                i += 1  # Skip first separator
                while i < len(lines) and "------------------" not in lines[i]:
                    i += 1
                i += 1  # Skip second separator to reach atom data
                while i < len(lines):
                    atom_line = lines[i].strip()
                    if "------------------" in atom_line or not atom_line:
                        break
                    parts = atom_line.split()
                    if len(parts) >= 6:
                        elem = parts[1]
                        type_flag = parts[2]
                        if type_flag in ("c", "bc"):  # Core atoms only
                            z = (
                                ATOMIC_SYMBOLS.index(elem)
                                if elem in ATOMIC_SYMBOLS
                                else 0
                            )
                            u, v, w = float(parts[3]), float(parts[4]), float(parts[5])
                            atomic_numbers.append(z)
                            frac_coords.append([u, v, w])
                    i += 1
            i += 1

        if not cell_matrix or not atomic_numbers:
            return None

        # Convert fractional to cartesian
        cart_coords = []
        for u, v, w in frac_coords:
            cx = u * cell_matrix[0][0] + v * cell_matrix[1][0] + w * cell_matrix[2][0]
            cy = u * cell_matrix[0][1] + v * cell_matrix[1][1] + w * cell_matrix[2][1]
            cz = u * cell_matrix[0][2] + v * cell_matrix[1][2] + w * cell_matrix[2][2]
            cart_coords.append([cx, cy, cz])

        return {
            "cell_matrix": cell_matrix,
            "atomic_numbers": atomic_numbers,
            "cart_coords": cart_coords,
            "energy": energy,
            "enthalpy": energy,  # In GULP zero-pressure, enthalpy = lattice energy
            "status": "Optimized",
        }
    except Exception as e:
        logger.error("Error reading GULP output %s: %s", got_path, e)
        return None


def generate_cif_fallback(
    matrix: List[List[float]],
    species: List[str],
    frac_coords: List[List[float]],
    formula: str,
    space_group_symbol: str = "P 1",
    space_group_number: int = 1,
) -> str:
    """Pure Python standardized CIF generation."""
    a, b, c, alpha, beta, gamma, _ = compute_lattice_params(matrix)
    lines = [
        "data_crystal",
        f"_chemical_formula_sum '{formula}'",
        f"_cell_length_a {a:.6f}",
        f"_cell_length_b {b:.6f}",
        f"_cell_length_c {c:.6f}",
        f"_cell_angle_alpha {alpha:.4f}",
        f"_cell_angle_beta {beta:.4f}",
        f"_cell_angle_gamma {gamma:.4f}",
        f"_symmetry_space_group_name_H-M '{space_group_symbol}'",
        f"_symmetry_Int_Tables_number {space_group_number}",
        "",
        "loop_",
        " _symmetry_equiv_pos_as_xyz",
        " 'x, y, z'",
        "",
        "loop_",
        " _atom_site_label",
        " _atom_site_type_symbol",
        " _atom_site_fract_x",
        " _atom_site_fract_y",
        " _atom_site_fract_z",
        " _atom_site_occupancy",
    ]

    element_counts: Dict[str, int] = {}
    for sym, frac in zip(species, frac_coords):
        element_counts[sym] = element_counts.get(sym, 0) + 1
        label = f"{sym}{element_counts[sym]}"
        lines.append(f" {label:<6} {sym:<3} {frac[0]:.6f} {frac[1]:.6f} {frac[2]:.6f} 1.000")

    lines.append("")
    return "\n".join(lines)


def analyze_symmetry_and_cif(
    matrix: List[List[float]],
    atomic_numbers: List[int],
    cart_coords: List[List[float]],
    symprec: float = 0.01,
) -> Tuple[SpaceGroupInfo, str, str, str, Dict[str, int]]:
    """Determine space group, chemical formula, and generate standardized CIF string.

    Tries pymatgen / spglib first; falls back to pure-Python geometry if unavailable.
    """
    species = [element_for_z(z) for z in atomic_numbers]
    comp_dict: Dict[str, int] = {}
    for s in species:
        comp_dict[s] = comp_dict.get(s, 0) + 1

    # Full formula string
    full_formula = "".join(f"{k}{comp_dict[k]}" for k in sorted(comp_dict.keys()))

    # Try pymatgen
    try:
        from pymatgen.core import Lattice, Structure
        from pymatgen.symmetry.analyzer import SpacegroupAnalyzer
        from pymatgen.io.cif import CifWriter

        pmg_lattice = Lattice(matrix)
        pmg_struct = Structure(pmg_lattice, species, cart_coords, coords_are_cartesian=True)

        sga = SpacegroupAnalyzer(pmg_struct, symprec=symprec)
        spg_symbol = sga.get_space_group_symbol()
        spg_num = sga.get_space_group_number()
        hall_symbol = sga.get_hall()
        reduced_formula = pmg_struct.composition.reduced_formula

        cif_content = CifWriter(pmg_struct, symprec=symprec).__str__()

        spg_info = SpaceGroupInfo(
            symbol=spg_symbol,
            number=spg_num,
            hall_symbol=hall_symbol,
        )
        return spg_info, cif_content, full_formula, reduced_formula, comp_dict
    except ImportError:
        pass
    except Exception as e:
        logger.debug("Pymatgen symmetry analysis fell back: %s", e)

    # Try spglib directly
    spg_num = 1
    spg_symbol = "P 1"
    hall = "P 1"
    try:
        import spglib
        import numpy as np

        inv_m = invert_3x3(matrix)
        fracs = [cartesian_to_fractional(pt, matrix) for pt in cart_coords]
        cell_tuple = (np.array(matrix), np.array(fracs), np.array(atomic_numbers))
        dataset = spglib.get_symmetry_dataset(cell_tuple, symprec=symprec)
        if dataset:
            spg_num = dataset.number
            spg_symbol = dataset.international
            hall = dataset.hall
    except ImportError:
        pass
    except Exception as e:
        logger.debug("Spglib analysis failed: %s", e)

    # Fallback CIF generation
    fracs = [cartesian_to_fractional(pt, matrix) for pt in cart_coords]
    cif_content = generate_cif_fallback(
        matrix=matrix,
        species=species,
        frac_coords=fracs,
        formula=full_formula,
        space_group_symbol=spg_symbol,
        space_group_number=spg_num,
    )

    spg_info = SpaceGroupInfo(
        symbol=spg_symbol,
        number=spg_num,
        hall_symbol=hall,
    )
    return spg_info, cif_content, full_formula, full_formula, comp_dict


def parse_structure_folder(
    folder_path: Path,
    summary_entry: Optional[Dict[str, Any]] = None,
    symprec: float = 0.01,
) -> Optional[ParsedStructure]:
    """Parse a single structure subdirectory (e.g. `00001x00001/`)."""
    dir_name = folder_path.name
    # Extract tag numbers
    match = re.match(r"^(\d+)x(\d+)$", dir_name)
    if not match:
        return None

    gen_padded, id_padded = match.groups()
    gen_int = int(gen_padded)
    id_int = int(id_padded)
    short_tag = f"{gen_int}x{id_int}"

    # Priority 1: structure.state
    state_file = folder_path / "structure.state"
    if not state_file.is_file():
        state_file = folder_path / "structure.state.old"

    data = None
    if state_file.is_file():
        data = parse_structure_state(state_file)

    # Priority 2: GULP xtal.got fallback
    if not data:
        got_file = folder_path / "xtal.got"
        if got_file.is_file():
            data = parse_gulp_output(got_file)

    if not data or not data.get("atomic_numbers") or not data.get("cell_matrix"):
        # If structure is in-flight or empty
        return None

    matrix = data["cell_matrix"]
    atomic_nums = data["atomic_numbers"]
    cart_coords = data["cart_coords"]
    num_atoms = len(atomic_nums)

    # Compute lattice
    a, b, c, alpha, beta, gamma, vol = compute_lattice_params(matrix)
    vol_per_atom = vol / num_atoms if num_atoms > 0 else 0.0

    # Compute symmetry and CIF
    spg_info, cif_str, full_formula, red_formula, comp_dict = analyze_symmetry_and_cif(
        matrix=matrix,
        atomic_numbers=atomic_nums,
        cart_coords=cart_coords,
        symprec=symprec,
    )

    # Calculate density (g/cm^3)
    # Mass in amu: 1 amu = 1.660539e-24 g, 1 A^3 = 1e-24 cm^3
    total_mass_amu = sum(
        APPROX_ATOMIC_WEIGHTS.get(element_for_z(z), float(z) * 2.0)
        for z in atomic_nums
    )
    density = (total_mass_amu * 1.660539) / vol if vol > 0 else 0.0

    # Atoms list
    atom_sites = []
    inv_m = invert_3x3(matrix)
    elem_counters: Dict[str, int] = {}
    for z, cart in zip(atomic_nums, cart_coords):
        elem = element_for_z(z)
        elem_counters[elem] = elem_counters.get(elem, 0) + 1
        label = f"{elem}{elem_counters[elem]}"
        frac = cartesian_to_fractional(cart, matrix)
        atom_sites.append(
            AtomSite(
                element=elem,
                atomic_number=z,
                cart_coords=cart,
                frac_coords=frac,
                label=label,
            )
        )

    # Merge with results.txt entry if available
    rank = summary_entry.get("rank") if summary_entry else None
    idx = summary_entry.get("index", data.get("index", 0)) if summary_entry else data.get("index", 0)
    enthalpy_atm = summary_entry.get("enthalpy_per_atom") if summary_entry else None
    abov_hull = summary_entry.get("dist_above_hull") if summary_entry else None
    pareto = summary_entry.get("pareto_front") if summary_entry else None
    status = summary_entry.get("status") if summary_entry else data.get("status", "Optimized")

    # If enthalpy_per_atom is missing from results.txt, compute from data
    tot_enthalpy = data.get("enthalpy")
    tot_energy = data.get("energy")
    if enthalpy_atm is None and tot_enthalpy is not None and num_atoms > 0:
        enthalpy_atm = tot_enthalpy / num_atoms

    lattice_obj = LatticeParameters(
        a=a,
        b=b,
        c=c,
        alpha=alpha,
        beta=beta,
        gamma=gamma,
        volume=vol,
        matrix=matrix,
    )

    return ParsedStructure(
        tag=short_tag,
        dir_name=dir_name,
        generation=gen_int,
        id_number=id_int,
        index=idx,
        rank=rank,
        formula=full_formula,
        reduced_formula=red_formula,
        num_atoms=num_atoms,
        composition=comp_dict,
        energy=tot_energy,
        enthalpy=tot_enthalpy,
        enthalpy_per_atom=enthalpy_atm,
        dist_above_hull=abov_hull,
        pareto_front=pareto,
        volume=vol,
        volume_per_atom=vol_per_atom,
        density=round(density, 4),
        space_group=spg_info,
        lattice=lattice_obj,
        atoms=atom_sites,
        status=status,
        cif=cif_str,
    )


def parse_experiment_structures(
    exp_id: str,
    base_runs_dir: Optional[Path] = None,
    symprec: float = 0.01,
) -> ExperimentStructuresSummary:
    """Scan localWorkingDirectory for all relaxed structures, parse geometries, and generate CIFs."""
    runs_root = base_runs_dir or settings.RUNS_DIR
    exp_dir = runs_root / exp_id
    work_dir = exp_dir / "localWorkingDirectory"

    if not work_dir.is_dir():
        return ExperimentStructuresSummary(
            exp_id=exp_id,
            total_structures=0,
            optimized_count=0,
            failed_count=0,
            structures=[],
        )

    # 1. Parse results.txt summary table
    results_file = work_dir / "results.txt"
    results_map: Dict[str, Dict[str, Any]] = {}
    if results_file.is_file():
        entries = parse_results_txt(results_file)
        for e in entries:
            # Map by tag (e.g. "1x1")
            results_map[e["tag"]] = e

    # 2. Find all structure folders matching \d+x\d+
    struct_dirs = [
        d for d in work_dir.iterdir()
        if d.is_dir() and re.match(r"^\d+x\d+$", d.name)
    ]
    struct_dirs.sort(key=lambda d: d.name)

    structures: List[ParsedStructure] = []
    opt_count = 0
    fail_count = 0
    lowest_enthalpy_tag = None
    lowest_enthalpy_val = None

    for sdir in struct_dirs:
        m = re.match(r"^(\d+)x(\d+)$", sdir.name)
        if not m:
            continue
        g, i = int(m.group(1)), int(m.group(2))
        tag = f"{g}x{i}"
        summary_info = results_map.get(tag)

        parsed = parse_structure_folder(sdir, summary_entry=summary_info, symprec=symprec)
        if parsed:
            structures.append(parsed)
            if "optim" in parsed.status.lower():
                opt_count += 1
            elif "fail" in parsed.status.lower():
                fail_count += 1

            if parsed.enthalpy_per_atom is not None:
                if (
                    lowest_enthalpy_val is None
                    or parsed.enthalpy_per_atom < lowest_enthalpy_val
                ):
                    lowest_enthalpy_val = parsed.enthalpy_per_atom
                    lowest_enthalpy_tag = parsed.tag

    # If results.txt contains entries whose directories didn't yield 3D geometries yet
    # (e.g. in-flight or waiting jobs), we still have accurate counts
    total = len(structures)

    return ExperimentStructuresSummary(
        exp_id=exp_id,
        total_structures=total,
        optimized_count=opt_count,
        failed_count=fail_count,
        lowest_enthalpy_tag=lowest_enthalpy_tag,
        lowest_enthalpy_per_atom=lowest_enthalpy_val,
        structures=structures,
    )

