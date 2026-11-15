"""File-based run manager for XtalOpt experiments.

Scans runs/*/meta.json to list experiments, manages workspace initialization,
and records config snapshots with zero database dependencies.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Dict, Any
import json
import logging

from ...config import settings
from ..schemas.run_schema import ExperimentCreateRequest, ExperimentItem
from ..schemas.config_schema import (
    XtalOptExperimentConfig,
    SearchLimits,
    OptimizerSettings,
)
from .config_generator import create_experiment_workspace, generate_xtalopt_in_content

logger = logging.getLogger(__name__)


def slugify_exp(name: str) -> str:
    """Create a URL/folder safe exp_id from name or timestamp."""
    cleaned = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in name.lower())
    cleaned = cleaned.strip("_")
    return cleaned or "run"


class RunStore:
    """Manages reading and writing runs/<exp_id>/meta.json on disk."""

    def __init__(self, runs_dir: Optional[Path] = None):
        self.runs_dir = runs_dir or settings.RUNS_DIR

    def list_experiments(self) -> List[ExperimentItem]:
        """List all experiment runs discovered in runs/*/meta.json."""
        self.runs_dir.mkdir(parents=True, exist_ok=True)
        items: List[ExperimentItem] = []

        for exp_folder in self.runs_dir.iterdir():
            if not exp_folder.is_dir():
                continue
            meta_file = exp_folder / "meta.json"
            if meta_file.is_file():
                try:
                    data = json.loads(meta_file.read_text(encoding="utf-8"))
                    items.append(
                        ExperimentItem(
                            exp_id=data.get("exp_id", exp_folder.name),
                            name=data.get("name", exp_folder.name),
                            status=data.get("status", "idle"),
                            pid=data.get("pid"),
                            created_at=data.get("created_at"),
                            chemicalFormulas=data.get("chemicalFormulas") or (data.get("config", {}).get("chemical_formulas")),
                            optimizer=data.get("optimizer") or (data.get("config", {}).get("optimizer_cfg", {}).get("optimizer", "gulp")),
                            config=data.get("config"),
                        )
                    )
                except Exception as e:
                    logger.error("Failed to read meta.json in %s: %s", exp_folder, e)
            else:
                # If folder exists with xtalopt.in but no meta.json, synthesize basic item
                if (exp_folder / "xtalopt.in").is_file():
                    items.append(
                        ExperimentItem(
                            exp_id=exp_folder.name,
                            name=exp_folder.name,
                            status="idle",
                            chemicalFormulas=None,
                            optimizer="gulp",
                        )
                    )

        # Sort newest first if created_at exists, else by exp_id
        items.sort(key=lambda x: x.created_at or x.exp_id, reverse=True)
        return items

    def get_experiment(self, exp_id: str) -> Optional[Dict[str, Any]]:
        """Get experiment metadata dict from runs/<exp_id>/meta.json."""
        meta_file = self.runs_dir / exp_id / "meta.json"
        if not meta_file.is_file():
            return None
        try:
            return json.loads(meta_file.read_text(encoding="utf-8"))
        except Exception as e:
            logger.error("Failed to read %s: %s", meta_file, e)
            return None

    def create_experiment(self, payload: ExperimentCreateRequest) -> Dict[str, Any]:
        """Scaffold runs/<exp_id>/, write meta.json, xtalopt.in, and templates/gulp/gin1."""
        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Determine exp_id
        if payload.exp_id:
            exp_id = slugify_exp(payload.exp_id)
        else:
            prefix = slugify_exp(payload.name) if payload.name else "run"
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            exp_id = f"{prefix}_{timestamp}"

        # Ensure unique directory
        base_exp_id = exp_id
        counter = 1
        while (self.runs_dir / exp_id).exists():
            exp_id = f"{base_exp_id}_{counter}"
            counter += 1

        exp_name = payload.name if payload.name else exp_id

        # Build full XtalOptExperimentConfig
        config = XtalOptExperimentConfig(
            chemical_formulas=payload.chemicalFormulas,
            min_atoms=payload.minAtoms,
            max_atoms=payload.maxAtoms,
            reference_energies=payload.referenceEnergies,
            search=SearchLimits(
                num_initial=payload.numInitial,
                parents_pool_size=payload.parentsPoolSize,
                max_num_structures=payload.maxNumStructures,
            ),
            optimizer_cfg=OptimizerSettings(
                optimizer=payload.optimizer,
                direct_run_command=payload.directRunCommand,
                custom_gulp_template=payload.ginTemplate,
            ),
        )

        # Create workspace directory, templates/gulp/gin1, localWorkingDirectory, xtalopt.in
        exp_dir = create_experiment_workspace(exp_id=exp_id, config=config, base_runs_dir=self.runs_dir)

        # Write runs/<exp_id>/meta.json
        meta_data = {
            "exp_id": exp_id,
            "name": exp_name,
            "description": payload.description,
            "status": "idle",
            "pid": None,
            "created_at": now_iso,
            "chemicalFormulas": payload.chemicalFormulas,
            "optimizer": payload.optimizer,
            "config": config.model_dump(),
        }
        meta_file = exp_dir / "meta.json"
        meta_file.write_text(json.dumps(meta_data, indent=2), encoding="utf-8")

        return meta_data


run_store = RunStore()

