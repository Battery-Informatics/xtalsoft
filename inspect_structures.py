#!/usr/bin/env python3
"""CLI utility to inspect and parse real structure files in XtalOpt.

Usage:
    python3 inspect_structures.py
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
SAMPLE_DIR = BASE_DIR / "XtalOpt" / "tests" / "sampledata"


def print_banner(title: str):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def inspect_results_table():
    print_banner("1. INSPECTING REAL results.txt SUMMARY TABLE")
    results_path = SAMPLE_DIR / "outputs" / "results.txt"
    if not results_path.is_file():
        print(f"File not found: {results_path}")
        return

    entries = parse_results_txt(results_path)
    print(f"Parsed {len(entries)} structures from {results_path.name}:\n")
    print(f"{'Rank':<5} {'Tag':<8} {'Formula':<10} {'Index':<6} {'Enthalpy/Atom':<15} {'SG':<6} {'Status':<12}")
    print("-" * 65)
    for e in entries:
        print(f"{e['rank']:<5} {e['tag']:<8} {e['formula']:<10} {e['index']:<6} {e['enthalpy_per_atom']:<15.6f} {e['space_group_number']:<6} {e['status']:<12}")


def inspect_structure_state():
    print_banner("2. INSPECTING REAL structure.state (Qt QSettings INI)")
    state_path = SAMPLE_DIR / "outputs" / "structure.state"
    if not state_path.is_file():
        print(f"File not found: {state_path}")
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
    print(f"  Lattice:           a={a:.3f} Å, b={b:.3f} Å, c={c:.3f} Å")
    print(f"  Angles:            alpha={alpha:.1f}°, beta={beta:.1f}°, gamma={gamma:.1f}°")
    print(f"  Cell Volume:       {vol:.3f} Å³")
    print(f"  Number of Atoms:   {len(data['atomic_numbers'])} (Z: {data['atomic_numbers']})")

    spg, cif, full_f, red_f, comp = analyze_symmetry_and_cif(
        matrix=matrix,
        atomic_numbers=data["atomic_numbers"],
        cart_coords=data["cart_coords"]
    )
    print(f"  Formula:           {full_f} (Reduced: {red_f})")
    print(f"  Space Group:       {spg.symbol} (#{spg.number})")

    print("\n  --- Standardized .cif output (first 18 lines) ---")
    cif_lines = cif.splitlines()[:18]
    for line in cif_lines:
        print("  " + line)


def inspect_gulp_output():
    print_banner("3. INSPECTING REAL GULP RELAXATION OUTPUT (xtal.got)")
    got_path = SAMPLE_DIR / "formats" / "optimizerSamples" / "gulp" / "xtal.got"
    if not got_path.is_file():
        print(f"File not found: {got_path}")
        return

    data = parse_gulp_output(got_path)
    print(f"Source file: {got_path}")
    print(f"  Relaxed Atoms:     {len(data['atomic_numbers'])}")
    print(f"  Lattice Energy:    {data['energy']} eV")
    print(f"  Status:            {data['status']}")

    matrix = data["cell_matrix"]
    a, b, c, alpha, beta, gamma, vol = compute_lattice_params(matrix)
    print(f"  Lattice:           a={a:.4f} Å, b={b:.4f} Å, c={c:.4f} Å")
    print(f"  Angles:            alpha={alpha:.2f}°, beta={beta:.2f}°, gamma={gamma:.2f}°")
    print(f"  Cell Volume:       {vol:.4f} Å³")

    spg, cif, full_f, red_f, comp = analyze_symmetry_and_cif(
        matrix=matrix,
        atomic_numbers=data["atomic_numbers"],
        cart_coords=data["cart_coords"]
    )
    print(f"  Composition:       {comp}")
    print(f"  Formula:           {full_f}")

    print("\n  --- Standardized .cif output for 3Dmol.js (excerpt) ---")
    cif_lines = cif.splitlines()[:22]
    for line in cif_lines:
        print("  " + line)


if __name__ == "__main__":
    inspect_results_table()
    inspect_structure_state()
    inspect_gulp_output()
    print("\n" + "=" * 70)
    print("  All real structure inspections completed successfully!")
    print("=" * 70 + "\n")
