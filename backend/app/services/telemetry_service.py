"""Telemetry service for XtalOpt live experiment status & population breakdown.

Parses real-time execution telemetry and population breakdown from:
- Subprocess manager (PID, exit code, elapsed runtime, stdout/stderr tails)
- localWorkingDirectory/ (results.txt, xtalopt.state, and structure.state files)
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional
import re
import logging

from ...config import settings
from ..schemas.telemetry_schema import (
    PopulationBreakdown,
    ExperimentTelemetry,
)
from .process_manager import process_manager
from .structure_parser import parse_results_txt, parse_structure_state
from .run_store import run_store

logger = logging.getLogger(__name__)


def get_experiment_telemetry(exp_id: str, tail_lines: int = 150) -> Dict[str, Any]:
    """Compile comprehensive live telemetry for an experiment run."""
    exp_dir = settings.RUNS_DIR / exp_id
    if not exp_dir.is_dir() and (settings.BASE_DIR / exp_id).is_dir():
        exp_dir = settings.BASE_DIR / exp_id

    # 1. Process Status & Logs
    proc_status = process_manager.get_run_status(exp_id)
    logs = process_manager.get_run_logs(exp_id, tail=tail_lines)

    # 2. Experiment metadata
    exp_meta = run_store.get_experiment(exp_id) or {}
    exp_name = exp_meta.get("name", exp_id)

    # 3. Population breakdown from localWorkingDirectory
    pop = PopulationBreakdown()
    seen_tags = set()

    work_dir = (
        exp_dir / "localWorkingDirectory"
        if (exp_dir / "localWorkingDirectory").is_dir()
        else exp_dir
    )

    if work_dir.is_dir():
        # Check results.txt
        results_file = work_dir / "results.txt"
        if results_file.is_file():
            entries = parse_results_txt(results_file)
            for e in entries:
                tag = e["tag"]
                seen_tags.add(tag)
                st = e["status"].lower()
                enth = e.get("enthalpy_per_atom")

                if "optim" in st:
                    pop.completed_optimized += 1
                elif "inprocess" in st or "updating" in st:
                    pop.currently_optimizing += 1
                elif "wait" in st or "submit" in st or "checking" in st:
                    pop.queued += 1
                elif "sim" in st or "duplicate" in st:
                    pop.duplicate += 1
                elif "fail" in st or "error" in st or "dismiss" in st:
                    pop.failed += 1
                else:
                    pop.queued += 1

                if enth is not None and "optim" in st:
                    if (
                        pop.best_enthalpy_per_atom is None
                        or enth < pop.best_enthalpy_per_atom
                    ):
                        pop.best_enthalpy_per_atom = enth
                        pop.best_structure_tag = tag

            pop.total_generated = len(entries)

        # Also inspect structure directories on disk
        for sdir in work_dir.iterdir():
            if sdir.is_dir() and re.match(r"^\d+x\d+$", sdir.name):
                m = re.match(r"^(\d+)x(\d+)$", sdir.name)
                if not m:
                    continue
                tag = f"{int(m.group(1))}x{int(m.group(2))}"
                if tag not in seen_tags:
                    seen_tags.add(tag)
                    pop.total_generated += 1
                    # Inspect structure.state if present
                    state_file = sdir / "structure.state"
                    if not state_file.is_file():
                        state_file = sdir / "structure.state.old"
                    if state_file.is_file():
                        st_data = parse_structure_state(state_file)
                        if st_data:
                            s_st = st_data.get("status", "").lower()
                            if "optim" in s_st:
                                pop.completed_optimized += 1
                            elif "inprocess" in s_st or "updating" in s_st:
                                pop.currently_optimizing += 1
                            elif "wait" in s_st or "submit" in s_st:
                                pop.queued += 1
                            elif "fail" in s_st or "error" in s_st:
                                pop.failed += 1
                            else:
                                pop.currently_optimizing += 1
                    else:
                        pop.currently_optimizing += 1

    now_iso = datetime.now(timezone.utc).isoformat()
    return {
        "exp_id": exp_id,
        "name": exp_name,
        "process": proc_status.model_dump(),
        "population": pop.model_dump(),
        "logs": logs.model_dump(),
        "updated_at": now_iso,
    }
