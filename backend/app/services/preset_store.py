"""File-based preset store for XtalOpt experiments.

Stores reusable presets as clean JSON files inside presets/*.json.
Automatically seeds default presets (fast Ti2O4-Ti4O8 and layered Li3NiMnCoO6 NMC111 cathode)
on startup if the directory is empty. Zero database required.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Dict, Any
import json
import logging
import re

from ...config import settings
from ..schemas.preset_schema import PresetCreate, PresetUpdate, PresetResponse

logger = logging.getLogger(__name__)


# Preset 1: Fast Ti2O4 - Ti4O8 test
FAST_TIO2_GIN_TEMPLATE = """opti conj conp
switch_minimiser bfgs gnorm 0.5
cell
  %a% %b% %c% %alphaDeg% %betaDeg% %gammaDeg%
frac
%coordsFrac%
species
Ti 2.196
O -1.098
buck
Ti Ti 31120.1 0.1540 5.25  15
O  O  11782.7 0.2340 30.22 15
Ti O  16957.5 0.1940 12.59 15
lennard 12 6
Ti Ti 1 0 15
O  O  1 0 15
Ti O  1 0 15
"""

# Preset 2: Layered Li3NiMnCoO6 (NMC111) cathode GULP preset
NMC111_GIN_TEMPLATE = """opti conj conp
switch_minimiser bfgs gnorm 0.5
cell
  %a% %b% %c% %alphaDeg% %betaDeg% %gammaDeg%
frac
%coordsFrac%
species
Li 1.000
Ni 2.000
Mn 4.000
Co 3.000
O -2.000
buck
# Buckingham potential parameters for battery cathode materials
Li O  426.48   0.3000   0.00   12.0
Ni O  1392.30  0.3030   0.00   12.0
Mn O  1267.50  0.3214   0.00   12.0
Co O  1329.80  0.3087   0.00   12.0
O  O  22764.0  0.1490  27.88   12.0
lennard 12 6
Li Li 1.0 0.0 12.0
Ni Ni 1.0 0.0 12.0
Mn Mn 1.0 0.0 12.0
Co Co 1.0 0.0 12.0
O  O  1.0 0.0 12.0
"""

DEFAULT_PRESETS = [
    {
        "id": "ti2o4-test",
        "name": "Ti2O4 - Ti4O8 Fast GULP Test",
        "description": "Standard fast-convergence titanium dioxide test system with Buckingham potential.",
        "chemicalFormulas": "Ti2O4 - Ti4O8",
        "minAtoms": 6,
        "maxAtoms": 12,
        "numInitial": 10,
        "popSize": 10,
        "maxNumStructures": 50,
        "optimizer": "gulp",
        "directRunCommand": "gulp",
        "ginTemplate": FAST_TIO2_GIN_TEMPLATE,
        "referenceEnergies": None,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    },
    {
        "id": "nmc111-cathode",
        "name": "Li3NiMnCoO6 (NMC111) Cathode",
        "description": "Layered lithium nickel manganese cobalt oxide cathode material for lithium-ion battery research.",
        "chemicalFormulas": "Li3Ni1Mn1Co1O6",
        "minAtoms": 12,
        "maxAtoms": 24,
        "numInitial": 20,
        "popSize": 20,
        "maxNumStructures": 100,
        "optimizer": "gulp",
        "directRunCommand": "gulp",
        "ginTemplate": NMC111_GIN_TEMPLATE,
        "referenceEnergies": None,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    },
]


def slugify(text: str) -> str:
    """Convert text into a safe filename slug."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-") or "preset"


class PresetStore:
    """Manages file-based preset templates in presets/*.json."""

    def __init__(self, presets_dir: Optional[Path] = None):
        self.presets_dir = presets_dir or settings.PRESETS_DIR
        self.ensure_seeded()

    def ensure_seeded(self) -> None:
        """Seed default presets if directory has no .json files."""
        self.presets_dir.mkdir(parents=True, exist_ok=True)
        existing_json = list(self.presets_dir.glob("*.json"))
        if not existing_json:
            logger.info("Presets directory empty. Seeding default presets to %s", self.presets_dir)
            for p in DEFAULT_PRESETS:
                file_path = self.presets_dir / f"{p['id']}.json"
                file_path.write_text(json.dumps(p, indent=2), encoding="utf-8")

    def list_presets(self) -> List[PresetResponse]:
        """Return all saved presets sorted by name."""
        self.ensure_seeded()
        results: List[PresetResponse] = []
        for p in self.presets_dir.glob("*.json"):
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                if "id" not in data:
                    data["id"] = p.stem
                results.append(PresetResponse(**data))
            except Exception as e:
                logger.error("Failed to parse preset file %s: %s", p, e)
        results.sort(key=lambda x: x.name)
        return results

    def get_preset(self, preset_id: str) -> Optional[PresetResponse]:
        """Fetch preset by ID."""
        file_path = self.presets_dir / f"{preset_id}.json"
        if not file_path.is_file():
            return None
        try:
            data = json.loads(file_path.read_text(encoding="utf-8"))
            if "id" not in data:
                data["id"] = preset_id
            return PresetResponse(**data)
        except Exception as e:
            logger.error("Failed to read preset %s: %s", preset_id, e)
            return None

    def create_preset(self, payload: PresetCreate) -> PresetResponse:
        """Create and save a new preset JSON file."""
        now_iso = datetime.now(timezone.utc).isoformat()
        preset_id = payload.id if payload.id else slugify(payload.name)
        
        # Ensure unique filename
        base_id = preset_id
        counter = 1
        while (self.presets_dir / f"{preset_id}.json").exists():
            preset_id = f"{base_id}-{counter}"
            counter += 1

        data = payload.model_dump()
        data["id"] = preset_id
        data["created_at"] = now_iso
        data["updated_at"] = now_iso

        file_path = self.presets_dir / f"{preset_id}.json"
        file_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        logger.info("Created preset %s at %s", preset_id, file_path)
        return PresetResponse(**data)

    def update_preset(self, preset_id: str, payload: PresetUpdate) -> Optional[PresetResponse]:
        """Update an existing preset JSON file."""
        file_path = self.presets_dir / f"{preset_id}.json"
        if not file_path.is_file():
            return None

        try:
            current_data = json.loads(file_path.read_text(encoding="utf-8"))
        except Exception:
            return None

        updates = {k: v for k, v in payload.model_dump().items() if v is not None}
        current_data.update(updates)
        current_data["id"] = preset_id
        current_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        file_path.write_text(json.dumps(current_data, indent=2), encoding="utf-8")
        logger.info("Updated preset %s", preset_id)
        return PresetResponse(**current_data)

    def delete_preset(self, preset_id: str) -> bool:
        """Delete a preset JSON file."""
        file_path = self.presets_dir / f"{preset_id}.json"
        if file_path.is_file():
            file_path.unlink()
            logger.info("Deleted preset %s", preset_id)
            return True
        return False

    def clone_preset(self, preset_id: str) -> Optional[PresetResponse]:
        """Clone an existing preset with a new ID."""
        original = self.get_preset(preset_id)
        if not original:
            return None

        clone_name = f"{original.name} (Copy)"
        clone_create = PresetCreate(
            name=clone_name,
            description=original.description,
            chemicalFormulas=original.chemicalFormulas,
            minAtoms=original.minAtoms,
            maxAtoms=original.maxAtoms,
            numInitial=original.numInitial,
            popSize=original.popSize,
            maxNumStructures=original.maxNumStructures,
            optimizer=original.optimizer,
            directRunCommand=original.directRunCommand,
            ginTemplate=original.ginTemplate,
            referenceEnergies=original.referenceEnergies,
        )
        return self.create_preset(clone_create)


preset_store = PresetStore()

