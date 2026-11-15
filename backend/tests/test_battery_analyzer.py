"""Unit tests for crystallography, battery analysis, and XRD simulation (Part 4)."""

import json
import shutil
import tempfile
from pathlib import Path

from backend.app.services.battery_analyzer import (
    compute_theoretical_battery_capacity,
    compute_bond_and_coordination_analysis,
    simulate_powder_xrd,
    generate_poscar_fallback,
    get_crystal_system,
    analyze_structure_comprehensive,
)
from backend.app.schemas.structure_schema import AtomSite
from backend.config import settings


def test_battery_capacity_calculations():
    """Verify gravimetric capacity calculations for NMC111 cathode and TiO2 anode."""
    # 1. Layered NMC111: Li3NiMnCoO6 (or LiNi0.33Mn0.33Co0.33O2)
    nmc_comp = {"Li": 3, "Ni": 1, "Mn": 1, "Co": 1, "O": 6}
    nmc_metrics = compute_theoretical_battery_capacity(nmc_comp, "Li3NiMnCoO6")
    assert nmc_metrics.num_li == 3
    assert nmc_metrics.molar_mass > 270.0
    # Capacity for 3 Li in Li3NiMnCoO6 should be ~282 mAh/g
    assert 270.0 <= nmc_metrics.theoretical_capacity_mah_g <= 295.0
    assert "Lithium transition-metal cathode" in (nmc_metrics.notes or "")

    # 2. TiO2 rutile/anatase: Ti2O4
    tio2_comp = {"Ti": 2, "O": 4}
    tio2_metrics = compute_theoretical_battery_capacity(tio2_comp, "Ti2O4")
    assert tio2_metrics.num_li == 0
    assert tio2_metrics.theoretical_capacity_mah_g == 0.0
    # Theoretical 1-electron Li insertion capacity should be ~335 mAh/g
    assert tio2_metrics.theoretical_insertion_capacity_mah_g is not None
    assert 320.0 <= tio2_metrics.theoretical_insertion_capacity_mah_g <= 350.0


def test_crystal_system_mapping():
    """Verify international space group number to crystal system mapping."""
    assert get_crystal_system(1) == "Triclinic"
    assert get_crystal_system(2) == "Triclinic"
    assert get_crystal_system(14) == "Monoclinic"
    assert get_crystal_system(62) == "Orthorhombic"
    assert get_crystal_system(136) == "Tetragonal"  # P4_2/mnm
    assert get_crystal_system(166) == "Trigonal"    # R-3m
    assert get_crystal_system(194) == "Hexagonal"   # P6_3/mmc
    assert get_crystal_system(221) == "Cubic"       # Pm-3m


def test_poscar_fallback_generation():
    """Verify standardized VASP POSCAR output generation."""
    matrix = [
        [4.5937, 0.0, 0.0],
        [0.0, 4.5937, 0.0],
        [0.0, 0.0, 2.9587],
    ]
    atoms = [
        AtomSite(element="Ti", atomic_number=22, cart_coords=[0, 0, 0], frac_coords=[0.0, 0.0, 0.0], label="Ti1"),
        AtomSite(element="O", atomic_number=8, cart_coords=[1.4, 1.4, 0], frac_coords=[0.305, 0.305, 0.0], label="O1"),
    ]

    poscar = generate_poscar_fallback(matrix, atoms, "Test POSCAR")
    assert "Direct" in poscar
    assert "Ti" in poscar
    assert "O" in poscar
    assert "4.5937" in poscar


def test_simulated_xrd_peaks():
    """Verify that powder XRD calculator produces non-empty peaks within 10°-80° 2-theta."""
    matrix = [
        [4.5937, 0.0, 0.0],
        [0.0, 4.5937, 0.0],
        [0.0, 0.0, 2.9587],
    ]
    atoms = [
        AtomSite(element="Ti", atomic_number=22, cart_coords=[0, 0, 0], frac_coords=[0.0, 0.0, 0.0], label="Ti1"),
        AtomSite(element="Ti", atomic_number=22, cart_coords=[2.3, 2.3, 1.48], frac_coords=[0.5, 0.5, 0.5], label="Ti2"),
        AtomSite(element="O", atomic_number=8, cart_coords=[1.4, 1.4, 0], frac_coords=[0.305, 0.305, 0.0], label="O1"),
        AtomSite(element="O", atomic_number=8, cart_coords=[3.2, 3.2, 0], frac_coords=[0.695, 0.695, 0.0], label="O2"),
    ]

    peaks = simulate_powder_xrd(matrix, atoms)
    assert len(peaks) > 0
    # Highest peak should be scaled to 100
    assert any(abs(p.intensity - 100.0) < 0.1 for p in peaks)
    for p in peaks:
        assert 10.0 <= p.two_theta <= 80.0
        assert p.d_spacing > 0.5
        assert "(" in p.hkl and ")" in p.hkl


def test_comprehensive_structure_analysis():
    """Verify end-to-end analyze_structure_comprehensive on a structure workspace."""
    temp_dir = Path(tempfile.mkdtemp(prefix="runs_analysis_test_"))
    try:
        exp_id = "test-analysis-run"
        exp_dir = temp_dir / exp_id
        work_dir = exp_dir / "localWorkingDirectory"
        sdir = work_dir / "00001x00001"
        sdir.mkdir(parents=True)

        # Write structure.state matching XtalOpt Qt format
        state_content = """[structure]
generation=1
id=1
index=0
status=0
parents=random atomic: comp=Ti2O4
current\\cell\\00=4.5937
current\\cell\\01=0.0000
current\\cell\\02=0.0000
current\\cell\\10=0.0000
current\\cell\\11=4.5937
current\\cell\\12=0.0000
current\\cell\\20=0.0000
current\\cell\\21=0.0000
current\\cell\\22=2.9587

current\\atomicNums\\size=6
current\\atomicNums\\1\\value=22
current\\atomicNums\\2\\value=22
current\\atomicNums\\3\\value=8
current\\atomicNums\\4\\value=8
current\\atomicNums\\5\\value=8
current\\atomicNums\\6\\value=8

current\\coords\\size=6
current\\coords\\1\\x=0.0000
current\\coords\\1\\y=0.0000
current\\coords\\1\\z=0.0000

current\\coords\\2\\x=2.2968
current\\coords\\2\\y=2.2968
current\\coords\\2\\z=1.4793

current\\coords\\3\\x=1.4010
current\\coords\\3\\y=1.4010
current\\coords\\3\\z=0.0000

current\\coords\\4\\x=3.1926
current\\coords\\4\\y=3.1926
current\\coords\\4\\z=0.0000

current\\coords\\5\\x=3.6979
current\\coords\\5\\y=0.8958
current\\coords\\5\\z=1.4793

current\\coords\\6\\x=0.8958
current\\coords\\6\\y=3.6979
current\\coords\\6\\z=1.4793
"""
        (sdir / "structure.state").write_text(state_content, encoding="utf-8")

        orig_runs = settings.RUNS_DIR
        settings.RUNS_DIR = temp_dir
        try:
            res = analyze_structure_comprehensive(exp_id, "1x1")
            assert res is not None
            assert res.tag == "1x1"
            assert "Ti" in res.formula and "O" in res.formula
            assert res.num_atoms == 6
            assert res.crystal_system in ("Tetragonal", "Orthorhombic", "Triclinic", "Cubic")
            assert len(res.cif_standardized) > 50
            assert len(res.poscar) > 50
            assert len(res.bond_analysis) > 0
            # Ti-O bond should be detected
            assert any("Ti-O" in b.pair for b in res.bond_analysis)
            assert len(res.xrd_peaks) > 0
            assert res.battery_metrics.theoretical_insertion_capacity_mah_g is not None
        finally:
            settings.RUNS_DIR = orig_runs

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    test_battery_capacity_calculations()
    test_crystal_system_mapping()
    test_poscar_fallback_generation()
    test_simulated_xrd_peaks()
    test_comprehensive_structure_analysis()
    print("All Part 4 Battery & XRD Analyzer tests passed successfully!")
