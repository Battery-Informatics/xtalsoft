"""Unit tests for live telemetry service and population breakdown (Part 3)."""

import json
import shutil
import tempfile
from pathlib import Path

from backend.app.services.telemetry_service import get_experiment_telemetry
from backend.config import settings


def test_telemetry_breakdown_from_workspace():
    """Verify telemetry breakdown calculation from results.txt and structure folders."""
    temp_dir = Path(tempfile.mkdtemp(prefix="runs_telemetry_test_"))
    try:
        exp_id = "test-telemetry-run"
        exp_dir = temp_dir / exp_id
        work_dir = exp_dir / "localWorkingDirectory"
        work_dir.mkdir(parents=True)

        # Write meta.json
        meta = {
            "exp_id": exp_id,
            "name": "Live Telemetry Test",
            "status": "running",
            "pid": 12345,
            "created_at": "2026-03-30T10:00:00Z"
        }
        (exp_dir / "meta.json").write_text(json.dumps(meta), encoding="utf-8")

        # Write results.txt matching XtalOpt format
        results_content = """ Rank Struct Formula Compos Index EnthalpyAtm Front AbovHullAtm SG Status
1 1x1 Ti2O4 1 0 -7.083333 0 0.000000 136 Optimized
2 1x2 Ti2O4 1 1 -6.866667 0 0.216666 1 Step2:InProcess
3 1x3 Ti2O4 1 2 0.000000 0 7.083333 1 Step1:Waiting
4 1x4 Ti2O4 1 3 -7.083333 0 0.000000 136 Sim:1x1
5 1x5 Ti2O4 1 4 0.000000 0 7.083333 1 Failed
6 2x1 Ti2O4 1 5 -7.200000 0 0.000000 141 Optimized
"""
        (work_dir / "results.txt").write_text(results_content, encoding="utf-8")

        # Write a structure folder with structure.state
        sdir = work_dir / "00002x00001"
        sdir.mkdir()
        (sdir / "structure.state").write_text("[general]\nparents=random atomic: comp=Ti2O4\nstatus=Optimized\n", encoding="utf-8")

        # Write fake stdout.log
        (exp_dir / "stdout.log").write_text("Starting XtalOpt CLI...\nGeneration 1 complete.\nGeneration 2 running.\n", encoding="utf-8")

        # Point settings.RUNS_DIR temporarily
        orig_runs = settings.RUNS_DIR
        settings.RUNS_DIR = temp_dir
        try:
            telemetry = get_experiment_telemetry(exp_id)
            assert telemetry["exp_id"] == exp_id
            assert telemetry["name"] == "Live Telemetry Test"

            pop = telemetry["population"]
            assert pop["total_generated"] == 6
            assert pop["completed_optimized"] == 2
            assert pop["currently_optimizing"] == 1
            assert pop["queued"] == 1
            assert pop["duplicate"] == 1
            assert pop["failed"] == 1

            # Best enthalpy per atom should be -7.200000 for 2x1
            assert pop["best_enthalpy_per_atom"] == -7.200000
            assert pop["best_structure_tag"] == "2x1"

            # Logs tail check
            logs = telemetry["logs"]
            assert len(logs["stdout_lines"]) >= 3
            assert "Generation 2 running." in logs["stdout_lines"][-1]
        finally:
            settings.RUNS_DIR = orig_runs

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    test_telemetry_breakdown_from_workspace()
    print("Telemetry tests passed successfully!")
