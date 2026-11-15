"""Unit tests for config generator service."""

from pathlib import Path
import shutil
import tempfile

from backend.app.schemas.config_schema import (
    XtalOptExperimentConfig,
    LatticeConstraints,
    VolumeConstraints,
    OptimizerSettings,
)
from backend.app.services.config_generator import (
    generate_xtalopt_in_content,
    create_experiment_workspace,
    get_default_gulp_template_for_formula,
)


def test_generate_xtalopt_in_content():
    """Verify that generated xtalopt.in contains required keys and proper formatting."""
    config = XtalOptExperimentConfig(
        chemical_formulas="Ti2O4 - Ti4O8",
        min_atoms=2,
        max_atoms=12,
        vc_search=False,
        lattice=LatticeConstraints(
            a_min=2.5, a_max=8.0,
            b_min=2.5, b_max=8.0,
            c_min=2.5, c_max=8.0,
            alpha_min=65.0, alpha_max=115.0,
            beta_min=65.0, beta_max=115.0,
            gamma_min=65.0, gamma_max=115.0,
        ),
        volume=VolumeConstraints(min_volume=2.0, max_volume=80.0),
        optimizer_cfg=OptimizerSettings(
            queue_interface="none",
            optimizer="gulp",
            direct_run_command="gulp",
            gin_templates="gin1",
        ),
    )

    content = generate_xtalopt_in_content(config)

    # Verify required keys
    assert "chemicalFormulas = Ti2O4 - Ti4O8" in content
    assert "queueInterface = none" in content
    assert "optimizer = gulp" in content
    assert "directRunCommand = gulp" in content
    assert "ginTemplates = gin1" in content
    assert "templatesDirectory = ./templates/gulp" in content
    assert "localWorkingDirectory = ./localWorkingDirectory" in content

    # Verify boolean lowercase format (true/false)
    assert "usingScaledIADs = true" in content
    assert "vcSearch = false" in content

    # Verify bounds
    assert "aMin = 2.5000" in content
    assert "aMax = 8.0000" in content
    assert "minVolume = 2.00" in content
    assert "maxVolume = 80.00" in content


def test_create_experiment_workspace():
    """Verify that create_experiment_workspace creates an isolated directory structure."""
    temp_dir = Path(tempfile.mkdtemp(prefix="xtalopt_test_runs_"))
    try:
        config = XtalOptExperimentConfig(chemical_formulas="TiO2")
        exp_id = "test_run_001"
        exp_dir = create_experiment_workspace(exp_id, config, base_runs_dir=temp_dir)

        assert exp_dir.is_dir()
        assert (exp_dir / "xtalopt.in").is_file()
        assert (exp_dir / "templates" / "gulp" / "gin1").is_file()
        assert (exp_dir / "localWorkingDirectory").is_dir()
        assert (exp_dir / "config.json").is_file()

        # Check gin1 has cell and coordsFrac tags
        gin_text = (exp_dir / "templates" / "gulp" / "gin1").read_text()
        assert "%a%" in gin_text
        assert "%coordsFrac%" in gin_text
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
