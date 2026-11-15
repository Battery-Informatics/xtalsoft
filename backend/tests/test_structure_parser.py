"""Unit tests for structure parser service against real XtalOpt outputs."""

from pathlib import Path
import tempfile
import shutil

from backend.app.services.structure_parser import (
    parse_results_txt,
    parse_structure_state,
    parse_structure_folder,
    compute_lattice_params,
    cartesian_to_fractional,
    generate_cif_fallback,
)

BASE_DIR = Path(__file__).resolve().parent.parent.parent
SAMPLE_OUTPUTS = BASE_DIR / "XtalOpt" / "tests" / "sampledata" / "outputs"


def test_parse_sample_results_txt():
    """Verify parser against real XtalOpt results.txt sample data."""
    results_path = SAMPLE_OUTPUTS / "results.txt"
    assert results_path.is_file(), f"Sample file not found at {results_path}"

    entries = parse_results_txt(results_path)
    assert len(entries) == 6

    # Verify first entry: Rank 1, Struct 1x1, Formula Ti1, Index 0, EnthalpyAtm -1.0, SG 221, Status Optimized
    e1 = entries[0]
    assert e1["rank"] == 1
    assert e1["tag"] == "1x1"
    assert e1["formula"] == "Ti1"
    assert e1["index"] == 0
    assert e1["enthalpy_per_atom"] == -1.0
    assert e1["space_group_number"] == 221
    assert e1["status"] == "Optimized"

    # Verify third entry: Rank 3, Struct 1x3, Formula O2Ti1, EnthalpyAtm -2.0, SG 99
    e3 = entries[2]
    assert e3["rank"] == 3
    assert e3["tag"] == "1x3"
    assert e3["formula"] == "O2Ti1"
    assert e3["enthalpy_per_atom"] == -2.0
    assert e3["space_group_number"] == 99


def test_parse_sample_structure_state():
    """Verify parsing real XtalOpt structure.state Qt QSettings INI file."""
    state_path = SAMPLE_OUTPUTS / "structure.state"
    assert state_path.is_file(), f"Sample file not found at {state_path}"

    data = parse_structure_state(state_path)
    assert data is not None

    assert data["generation"] == 3
    assert data["id_number"] == 7
    assert data["index"] == 4
    assert data["status"] == "Optimized"
    assert data["energy"] == -10.0
    assert data["enthalpy"] == -9.75

    # Check cell matrix: 5x5x5 cubic
    mat = data["cell_matrix"]
    assert mat[0][0] == 5.0 and mat[1][1] == 5.0 and mat[2][2] == 5.0

    # Check atoms: Ti (22) and O (8)
    assert data["atomic_numbers"] == [22, 8]
    assert len(data["cart_coords"]) == 2
    assert data["cart_coords"][0] == [0.0, 0.0, 0.0]
    assert data["cart_coords"][1] == [0.25, 0.25, 0.25]


def test_lattice_geometry_calculations():
    """Verify cubic and orthorhombic lattice math."""
    cubic = [
        [5.0, 0.0, 0.0],
        [0.0, 5.0, 0.0],
        [0.0, 0.0, 5.0],
    ]
    a, b, c, alpha, beta, gamma, vol = compute_lattice_params(cubic)
    assert round(a, 4) == 5.0
    assert round(b, 4) == 5.0
    assert round(c, 4) == 5.0
    assert round(alpha, 2) == 90.0
    assert round(beta, 2) == 90.0
    assert round(gamma, 2) == 90.0
    assert round(vol, 4) == 125.0

    # Fractional conversion
    cart = [1.25, 2.5, 3.75]
    frac = cartesian_to_fractional(cart, cubic)
    assert round(frac[0], 4) == 0.25
    assert round(frac[1], 4) == 0.50
    assert round(frac[2], 4) == 0.75


def test_structure_folder_parsing_and_cif_generation():
    """Test full directory structure parsing and CIF generation."""
    temp_dir = Path(tempfile.mkdtemp(prefix="xtalopt_struct_test_"))
    try:
        struct_dir = temp_dir / "00003x00007"
        struct_dir.mkdir(parents=True)
        # Copy real sample structure.state
        src_state = SAMPLE_OUTPUTS / "structure.state"
        shutil.copy(src_state, struct_dir / "structure.state")

        summary_entry = {
            "rank": 1,
            "tag": "3x7",
            "enthalpy_per_atom": -4.875,
            "dist_above_hull": 0.0,
            "status": "Optimized",
        }

        parsed = parse_structure_folder(struct_dir, summary_entry=summary_entry)
        assert parsed is not None
        assert parsed.tag == "3x7"
        assert parsed.dir_name == "00003x00007"
        assert parsed.generation == 3
        assert parsed.id_number == 7
        assert parsed.num_atoms == 2
        assert "Ti" in parsed.composition
        assert "O" in parsed.composition
        assert parsed.enthalpy_per_atom == -4.875
        assert parsed.volume == 125.0
        assert parsed.status == "Optimized"

        # Verify CIF string
        assert parsed.cif is not None
        assert "data_crystal" in parsed.cif or "data_" in parsed.cif
        assert "_cell_length_a" in parsed.cif
        assert "_atom_site" in parsed.cif
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

