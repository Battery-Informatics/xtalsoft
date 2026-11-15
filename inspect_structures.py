#!/usr/bin/env python3
"""CLI utility to inspect and parse real structure files in XtalOpt.

Usage:
    python inspect_structures.py [optional_directory]
"""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from backend.app.services.structure_parser import (
    parse_results_txt,
    parse_structure_state,
    parse_gulp_output,
    analyze_symmetry_and_cif,
    compute_lattice_params,
)

BASE_DIR = Path(__file__).resolve().parent

# Auto-detect run directory: CLI argument > latest experiment in runs/ > direct runs/ or res/
if len(sys.argv) > 1:
    arg_path = Path(sys.argv[1])
    RUN_DIR = arg_path if arg_path.is_absolute() else (BASE_DIR / arg_path)
else:
    recent_exp = None
    if (BASE_DIR / "runs").is_dir():
        exp_candidates = [
            p for p in (BASE_DIR / "runs").iterdir()
            if p.is_dir() and not p.name.startswith("0000") and (p / "localWorkingDirectory" / "results.txt").is_file()
        ]
        if exp_candidates:
            exp_candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
            recent_exp = exp_candidates[0]

    if recent_exp:
        RUN_DIR = recent_exp / "localWorkingDirectory"
    elif (BASE_DIR / "runs" / "results.txt").is_file():
        RUN_DIR = BASE_DIR / "runs"
    elif (BASE_DIR / "res" / "results.txt").is_file():
        RUN_DIR = BASE_DIR / "res"
    elif (BASE_DIR / "xtalopt_latest" / "tests" / "sampledata").is_dir():
        RUN_DIR = BASE_DIR / "xtalopt_latest" / "tests" / "sampledata"
    else:
        RUN_DIR = BASE_DIR / "runs"

if (RUN_DIR / "localWorkingDirectory").is_dir():
    RUN_DIR = RUN_DIR / "localWorkingDirectory"


def print_banner(title: str):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def inspect_results_table():
    print_banner(f"1. INSPECTING results.txt FROM: {RUN_DIR}")
    results_path = RUN_DIR / "results.txt"
    if not results_path.is_file():
        # Check outputs/ subfolder (used by sampledata)
        results_path = RUN_DIR / "outputs" / "results.txt"

    if not results_path.is_file():
        print(f"File not found: results.txt in {RUN_DIR}")
        return []

    entries = parse_results_txt(results_path)
    print(f"Total structures in run: {len(entries)}\n")
    print(f"{'Rank':<5} {'Tag':<8} {'Formula':<10} {'Index':<6} {'Enthalpy/Atom':<16} {'SG':<6} {'Status':<12}")
    print("-" * 68)
    for e in entries[:20]:
        print(f"{e['rank']:<5} {e['tag']:<8} {e['formula']:<10} {e['index']:<6} {e['enthalpy_per_atom']:<16.6f} {e['space_group_number']:<6} {e['status']:<12}")
    if len(entries) > 20:
        print(f"... and {len(entries) - 20} more structures.")
    return entries


def inspect_structure_state(entries=None):
    print_banner("2. INSPECTING LOWEST ENERGY / GROUND STATE STRUCTURE")
    state_path = None
    target_tag = "1x1"
    best_entry = None
    if entries and len(entries) > 0:
        # Find the entry with the lowest enthalpy per atom (global minimum)
        valid_entries = [e for e in entries if e.get("enthalpy_per_atom") is not None]
        if valid_entries:
            best_entry = min(valid_entries, key=lambda x: x["enthalpy_per_atom"])
            target_tag = best_entry["tag"]
            print(f"  Target:            Structure {target_tag} (Rank {best_entry.get('rank', 1)}, Lowest Enthalpy: {best_entry.get('enthalpy_per_atom'):.6f} eV/atom)")
        else:
            target_tag = entries[0]["tag"]

    if "x" in target_tag:
        parts = target_tag.split("x")
        try:
            g, i = int(parts[0]), int(parts[1])
            folder_name = f"{g:05d}x{i:05d}"
            candidate = RUN_DIR / folder_name / "structure.state"
            if candidate.is_file():
                state_path = candidate
        except ValueError:
            pass

    if not state_path or not state_path.is_file():
        # Fallbacks: direct structure.state or outputs/structure.state
        for cand in [RUN_DIR / "structure.state", RUN_DIR / "outputs" / "structure.state"]:
            if cand.is_file():
                state_path = cand
                break

    if not state_path or not state_path.is_file():
        print(f"structure.state not found in {RUN_DIR}")
        return

    data = parse_structure_state(state_path)
    print(f"Source file: {state_path}")
    print(f"  Generation:        {data['generation']}")
    print(f"  ID Number:         {data['id_number']}")
    print(f"  Global Index:      {data['index']}")
    print(f"  Lifecycle Status:  {data['status']}")
    print(f"  Total Energy:      {data['energy']} eV")
    print(f"  Total Enthalpy:    {data['enthalpy']} eV")

    matrix = data["cell_matrix"]
    a, b, c, alpha, beta, gamma, vol = compute_lattice_params(matrix)
    print(f"  Lattice:           a={a:.3f} A, b={b:.3f} A, c={c:.3f} A")
    print(f"  Angles:            alpha={alpha:.1f} deg, beta={beta:.1f} deg, gamma={gamma:.1f} deg")
    print(f"  Cell Volume:       {vol:.3f} A^3")
    print(f"  Number of Atoms:   {len(data['atomic_numbers'])} (Z: {data['atomic_numbers']})")

    spg, cif, full_f, red_f, comp = analyze_symmetry_and_cif(
        matrix=matrix,
        atomic_numbers=data["atomic_numbers"],
        cart_coords=data["cart_coords"]
    )
    print(f"  Formula:           {full_f} (Reduced: {red_f})")
    print(f"  Space Group:       {spg.symbol} (#{spg.number})")

    print("\n  --- Standardized .cif output (first 25 lines) ---")
    cif_lines = cif.splitlines()[:25]
    for line in cif_lines:
        print("  " + line)


def inspect_gulp_output(entries=None):
    print_banner("3. INSPECTING GULP RELAXATION OUTPUT (xtal.got)")
    got_path = None
    target_tag = "1x1"
    if entries and len(entries) > 0:
        valid_entries = [e for e in entries if e.get("enthalpy_per_atom") is not None]
        if valid_entries:
            best_entry = min(valid_entries, key=lambda x: x["enthalpy_per_atom"])
            target_tag = best_entry["tag"]
        else:
            target_tag = entries[0]["tag"]

    if "x" in target_tag:
        parts = target_tag.split("x")
        try:
            g, i = int(parts[0]), int(parts[1])
            folder_name = f"{g:05d}x{i:05d}"
            candidate = RUN_DIR / folder_name / "xtal.got"
            if candidate.is_file():
                got_path = candidate
        except ValueError:
            pass

    if not got_path or not got_path.is_file():
        for cand in [
            RUN_DIR / "xtal.got",
            RUN_DIR / "formats" / "optimizerSamples" / "gulp" / "xtal.got",
            BASE_DIR / "xtalopt_latest" / "tests" / "sampledata" / "formats" / "optimizerSamples" / "gulp" / "xtal.got",
        ]:
            if cand.is_file():
                got_path = cand
                break

    if not got_path or not got_path.is_file():
        print(f"xtal.got not found in {RUN_DIR}")
        return

    data = parse_gulp_output(got_path)
    print(f"Source file: {got_path}")
    print(f"  Relaxed Atoms:     {len(data['atomic_numbers'])}")
    print(f"  Lattice Energy:    {data['energy']} eV")
    print(f"  Status:            {data['status']}")

    matrix = data["cell_matrix"]
    a, b, c, alpha, beta, gamma, vol = compute_lattice_params(matrix)
    print(f"  Lattice:           a={a:.4f} A, b={b:.4f} A, c={c:.4f} A")
    print(f"  Angles:            alpha={alpha:.2f} deg, beta={beta:.2f} deg, gamma={gamma:.2f} deg")
    print(f"  Cell Volume:       {vol:.4f} A^3")

    spg, cif, full_f, red_f, comp = analyze_symmetry_and_cif(
        matrix=matrix,
        atomic_numbers=data["atomic_numbers"],
        cart_coords=data["cart_coords"]
    )
    print(f"  Composition:       {comp}")
    print(f"  Formula:           {full_f}")


if __name__ == "__main__":
    entries = inspect_results_table()
    inspect_structure_state(entries)
    inspect_gulp_output(entries)
    print("\n" + "=" * 70)
    print("  Structure inspection completed successfully!")
    print("=" * 70 + "\n")
