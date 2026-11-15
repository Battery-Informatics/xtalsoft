"""API routes for XtalOpt Web Workbench.

Provides endpoints for workspace initialization, CLI process controls,
log streaming, and crystal structure inspection.
"""

from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status

from ..schemas.config_schema import XtalOptExperimentConfig
from ..schemas.run_schema import RunStatusResponse, RunLogsResponse
from ..schemas.structure_schema import (
    ParsedStructure,
    ExperimentStructuresSummary,
)
from ..services.config_generator import create_experiment_workspace
from ..services.process_manager import process_manager
from ..services.structure_parser import (
    parse_experiment_structures,
    parse_structure_folder,
)
from ...config import settings

router = APIRouter()


@router.get("/health", tags=["System"])
def health_check():
    """Verify backend system status and path configurations."""
    bin_exists = settings.XTALOPT_BIN_PATH.is_file()
    runs_dir_exists = settings.RUNS_DIR.is_dir()
    return {
        "status": "online",
        "version": settings.VERSION,
        "xtalopt_bin_path": str(settings.XTALOPT_BIN_PATH),
        "xtalopt_bin_found": bin_exists,
        "runs_dir": str(settings.RUNS_DIR),
        "runs_dir_found": runs_dir_exists,
    }


@router.post(
    "/experiments/{exp_id}/generate",
    status_code=status.HTTP_201_CREATED,
    tags=["Experiment Configuration"],
)
def generate_experiment_workspace(
    exp_id: str,
    config: XtalOptExperimentConfig,
):
    """Generate isolated runs/<exp_id>/ workspace with xtalopt.in and GULP template."""
    try:
        exp_dir = create_experiment_workspace(exp_id=exp_id, config=config)
        return {
            "message": f"Successfully generated experiment workspace for {exp_id}",
            "exp_id": exp_id,
            "workspace_dir": str(exp_dir),
            "xtalopt_in_path": str(exp_dir / "xtalopt.in"),
            "gulp_template_path": str(exp_dir / "templates" / "gulp" / "gin1"),
            "local_working_dir": str(exp_dir / "localWorkingDirectory"),
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate experiment workspace: {e}",
        )


@router.post(
    "/runs/{exp_id}/start",
    response_model=RunStatusResponse,
    tags=["Subprocess Runner"],
)
def start_xtalopt_run(exp_id: str):
    """Spawn `./bin/xtalopt --cli` inside the experiment workspace."""
    try:
        return process_manager.start_run(exp_id=exp_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/runs/{exp_id}/stop",
    response_model=RunStatusResponse,
    tags=["Subprocess Runner"],
)
def stop_xtalopt_run(exp_id: str, timeout: int = Query(5, ge=1, le=30)):
    """Stop/kill a running XtalOpt subprocess."""
    try:
        return process_manager.stop_run(exp_id=exp_id, timeout=timeout)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/runs/{exp_id}/status",
    response_model=RunStatusResponse,
    tags=["Subprocess Runner"],
)
def get_run_status(exp_id: str):
    """Get live execution status, PID, and elapsed time."""
    return process_manager.get_run_status(exp_id=exp_id)


@router.get(
    "/runs/{exp_id}/logs",
    response_model=RunLogsResponse,
    tags=["Subprocess Runner"],
)
def get_run_logs(exp_id: str, tail: int = Query(200, ge=1, le=5000)):
    """Retrieve captured stdout and stderr execution logs."""
    return process_manager.get_run_logs(exp_id=exp_id, tail=tail)


@router.get(
    "/runs/{exp_id}/structures",
    response_model=ExperimentStructuresSummary,
    tags=["Structure Visualizer & Parser"],
)
def get_experiment_structures(
    exp_id: str,
    symprec: float = Query(0.01, ge=0.0001, le=0.5, description="Spglib symmetry tolerance"),
):
    """Parse all relaxed structures in localWorkingDirectory and return metadata + CIFs."""
    exp_dir = settings.RUNS_DIR / exp_id
    if not exp_dir.is_dir():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment directory {exp_id} does not exist.",
        )
    return parse_experiment_structures(exp_id=exp_id, symprec=symprec)


@router.get(
    "/runs/{exp_id}/structures/{tag}",
    response_model=ParsedStructure,
    tags=["Structure Visualizer & Parser"],
)
def get_single_structure(
    exp_id: str,
    tag: str,
    symprec: float = Query(0.01, ge=0.0001, le=0.5),
):
    """Retrieve full metadata and standardized CIF for a specific structure tag (e.g. '1x1')."""
    exp_dir = settings.RUNS_DIR / exp_id
    work_dir = exp_dir / "localWorkingDirectory"
    if not work_dir.is_dir():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No localWorkingDirectory found for experiment {exp_id}.",
        )

    # Convert tag e.g. "1x1" to directory format "00001x00001" or search match
    folder_target = None
    if "x" in tag:
        parts = tag.split("x")
        try:
            g, i = int(parts[0]), int(parts[1])
            padded_name = f"{g:05d}x{i:05d}"
            candidate = work_dir / padded_name
            if candidate.is_dir():
                folder_target = candidate
        except ValueError:
            pass

    if not folder_target:
        # Check direct folder match
        direct = work_dir / tag
        if direct.is_dir():
            folder_target = direct

    if not folder_target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Structure with tag '{tag}' not found in experiment {exp_id}.",
        )

    parsed = parse_structure_folder(folder_target, symprec=symprec)
    if not parsed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not parse geometry for structure {tag}.",
        )

    return parsed

