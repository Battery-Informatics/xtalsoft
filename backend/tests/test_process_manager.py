"""Unit tests for subprocess manager."""

from pathlib import Path
import tempfile
import shutil

from backend.app.services.process_manager import XtalOptProcessManager


def test_process_manager_missing_workspace():
    """Verify clean error when starting a run with non-existent workspace."""
    temp_dir = Path(tempfile.mkdtemp(prefix="xtalopt_pm_test_"))
    try:
        pm = XtalOptProcessManager(runs_dir=temp_dir, bin_path=temp_dir / "nonexistent_bin")
        caught = False
        try:
            pm.start_run("missing_exp")
        except FileNotFoundError as e:
            caught = True
            assert "Experiment workspace does not exist" in str(e)
        assert caught, "Expected FileNotFoundError"
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_process_manager_missing_bin():
    """Verify clean error when binary is missing."""
    temp_dir = Path(tempfile.mkdtemp(prefix="xtalopt_pm_test_"))
    try:
        exp_dir = temp_dir / "exp_01"
        exp_dir.mkdir(parents=True)
        (exp_dir / "xtalopt.in").write_text("chemicalFormulas = TiO2\n")

        pm = XtalOptProcessManager(runs_dir=temp_dir, bin_path=temp_dir / "fake_xtalopt_bin")
        caught = False
        try:
            pm.start_run("exp_01")
        except FileNotFoundError as e:
            caught = True
            assert "XtalOpt binary not found" in str(e)
        assert caught, "Expected FileNotFoundError"
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_process_manager_idle_status():
    """Verify status query on non-running experiment."""
    temp_dir = Path(tempfile.mkdtemp(prefix="xtalopt_pm_test_"))
    try:
        pm = XtalOptProcessManager(runs_dir=temp_dir)
        status = pm.get_run_status("nonexistent_run")
        assert status.status == "idle"
        assert status.pid is None
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

