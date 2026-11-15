"""API routes for XtalOpt Web Workbench.

Provides endpoints for:
- Preset management (presets/*.json)
- Experiment runs lifecycle and metadata (runs/<exp_id>/meta.json)
- Subprocess controls and logging
- Structure inspection and CIF generation
"""

import json
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, status

logger = logging.getLogger(__name__)

from ..schemas.config_schema import XtalOptExperimentConfig
from ..schemas.preset_schema import (
    PresetCreate,
    PresetUpdate,
    PresetResponse,
)
from ..schemas.run_schema import (
    ExperimentCreateRequest,
    ExperimentItem,
    RunStatusResponse,
    RunLogsResponse,
)
from ..schemas.structure_schema import (
    ParsedStructure,
    ExperimentStructuresSummary,
)
from ..services.config_generator import (
    create_experiment_workspace,
    generate_xtalopt_in_content,
)
from ..services.preset_store import preset_store
from ..services.run_store import run_store
from ..services.process_manager import process_manager
from ..services.structure_parser import (
    parse_experiment_structures,
    parse_structure_folder,
)
from ...config import settings

router = APIRouter()


# ==============================================================================
# System Health
# ==============================================================================

@router.get("/health", tags=["System"])
def health_check():
    """Verify backend system status and path configurations."""
    bin_exists = settings.XTALOPT_BIN_PATH.is_file()
    runs_dir_exists = settings.RUNS_DIR.is_dir()
    presets_dir_exists = settings.PRESETS_DIR.is_dir()
    return {
        "status": "online",
        "version": settings.VERSION,
        "xtalopt_bin_path": str(settings.XTALOPT_BIN_PATH),
        "xtalopt_bin_found": bin_exists,
        "runs_dir": str(settings.RUNS_DIR),
        "runs_dir_found": runs_dir_exists,
        "presets_dir": str(settings.PRESETS_DIR),
        "presets_dir_found": presets_dir_exists,
    }


# ==============================================================================
# Presets API (presets/*.json)
# ==============================================================================

@router.get("/presets", response_model=List[PresetResponse], tags=["Presets"])
def list_presets():
    """List all saved experiment presets from presets/*.json."""
    return preset_store.list_presets()


@router.post("/presets", response_model=PresetResponse, status_code=status.HTTP_201_CREATED, tags=["Presets"])
def create_preset(payload: PresetCreate):
    """Save a new experiment preset as a JSON file in presets/."""
    try:
        return preset_store.create_preset(payload)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save preset: {e}",
        )


@router.get("/presets/{preset_id}", response_model=PresetResponse, tags=["Presets"])
def get_preset(preset_id: str):
    """Get a specific preset by its slug ID."""
    preset = preset_store.get_preset(preset_id)
    if not preset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset not found")
    return preset


@router.put("/presets/{preset_id}", response_model=PresetResponse, tags=["Presets"])
def update_preset(preset_id: str, payload: PresetUpdate):
    """Update an existing preset JSON file."""
    updated = preset_store.update_preset(preset_id, payload)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset not found")
    return updated


@router.delete("/presets/{preset_id}", tags=["Presets"])
def delete_preset(preset_id: str):
    """Delete a preset JSON file."""
    deleted = preset_store.delete_preset(preset_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset not found")
    return {"message": f"Preset '{preset_id}' deleted successfully", "id": preset_id}


@router.post("/presets/{preset_id}/clone", response_model=PresetResponse, status_code=status.HTTP_201_CREATED, tags=["Presets"])
def clone_preset(preset_id: str):
    """Clone an existing preset into a new copy JSON file."""
    cloned = preset_store.clone_preset(preset_id)
    if not cloned:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preset not found to clone")
    return cloned


# ==============================================================================
# Experiments API (runs/<exp_id>/meta.json + xtalopt.in)
# ==============================================================================

@router.post(
    "/experiments",
    status_code=status.HTTP_201_CREATED,
    tags=["Experiments"],
)
def create_experiment(payload: ExperimentCreateRequest):
    """Create runs/<exp_id>/, write meta.json, xtalopt.in, gin1, and optionally launch ./bin/xtalopt --cli."""
    try:
        meta_data = run_store.create_experiment(payload)
        exp_id = meta_data["exp_id"]

        started = False
        start_message = None
        pid = None

        if payload.start_immediately:
            try:
                run_res = process_manager.start_run(exp_id=exp_id)
                started = (run_res.status == "running")
                start_message = run_res.message
                pid = run_res.pid
                if started:
                    meta_file = settings.RUNS_DIR / exp_id / "meta.json"
                    if meta_file.is_file():
                        try:
                            m_data = json.loads(meta_file.read_text(encoding="utf-8"))
                            m_data["status"] = "running"
                            m_data["pid"] = pid
                            meta_file.write_text(json.dumps(m_data, indent=2), encoding="utf-8")
                        except Exception:
                            pass
            except Exception as ex:
                logger.error("Failed to start run %s: %s", exp_id, ex)
                start_message = f"Workspace created, but subprocess could not start: {ex}"

        return {
            "message": "Experiment created successfully",
            "exp_id": exp_id,
            "name": meta_data["name"],
            "status": "running" if started else "idle",
            "pid": pid,
            "started": started,
            "start_message": start_message,
            "created_at": meta_data["created_at"],
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create experiment: {e}",
        )


@router.get(
    "/experiments",
    response_model=List[ExperimentItem],
    tags=["Experiments"],
)
def list_experiments():
    """List all experiment runs discovered from runs/*/meta.json."""
    items = run_store.list_experiments()
    for item in items:
        try:
            st = process_manager.get_run_status(item.exp_id)
            if st.status not in ("idle", "unknown"):
                item.status = st.status
                item.pid = st.pid
        except Exception:
            pass
    return items


@router.get(
    "/experiments/{exp_id}",
    tags=["Experiments"],
)
def get_experiment_details(exp_id: str):
    """Get metadata and configuration snapshot for an experiment."""
    meta = run_store.get_experiment(exp_id)
    if not meta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Experiment '{exp_id}' not found")
    
    # Check live status from process manager
    live_status = process_manager.get_run_status(exp_id)
    meta["live_status"] = live_status.model_dump()
    return meta


@router.post(
    "/experiments/{exp_id}/stop",
    response_model=RunStatusResponse,
    tags=["Experiments"],
)
def stop_experiment_run(exp_id: str, timeout: int = Query(5, ge=1, le=30)):
    """Stop/kill active ./bin/xtalopt --cli process for this experiment."""
    try:
        return process_manager.stop_run(exp_id=exp_id, timeout=timeout)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/experiments/preview-xtalopt-in",
    tags=["Experiments"],
)
def preview_xtalopt_in(config: XtalOptExperimentConfig):
    """Generate and return in-memory live preview of xtalopt.in text."""
    try:
        content = generate_xtalopt_in_content(config)
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==============================================================================
# Subprocess Runs & Logs
# ==============================================================================

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


# ==============================================================================
# Crystal Structure Visualizer & Results
# ==============================================================================

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
    if not exp_dir.is_dir() and (settings.BASE_DIR / exp_id).is_dir():
        exp_dir = settings.BASE_DIR / exp_id

    if not exp_dir.is_dir():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment directory {exp_id} does not exist.",
        )
    return parse_experiment_structures(exp_id=exp_id, base_runs_dir=exp_dir.parent, symprec=symprec)


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
    if not exp_dir.is_dir() and (settings.BASE_DIR / exp_id).is_dir():
        exp_dir = settings.BASE_DIR / exp_id

    if (exp_dir / "localWorkingDirectory").is_dir():
        work_dir = exp_dir / "localWorkingDirectory"
    elif exp_dir.is_dir():
        work_dir = exp_dir
    else:
        work_dir = exp_dir / "localWorkingDirectory"

    if not work_dir.is_dir():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No working directory found for experiment {exp_id}.",
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
