"""Unit tests for file-based presets and run store (Part 2)."""

import json
import shutil
import tempfile
from pathlib import Path

from backend.app.services.preset_store import PresetStore
from backend.app.services.run_store import RunStore
from backend.app.schemas.preset_schema import PresetCreate, PresetUpdate
from backend.app.schemas.run_schema import ExperimentCreateRequest


def test_preset_store_seeding():
    """Verify that presets/ is seeded with Ti2O4 and NMC111 defaults if empty."""
    temp_dir = Path(tempfile.mkdtemp(prefix="presets_test_"))
    try:
        store = PresetStore(presets_dir=temp_dir)
        presets = store.list_presets()
        assert len(presets) >= 2

        ids = [p.id for p in presets]
        assert "ti2o4-test" in ids
        assert "nmc111-cathode" in ids

        # Verify content
        ti = store.get_preset("ti2o4-test")
        assert ti is not None
        assert ti.chemicalFormulas == "Ti2O4 - Ti4O8"
        assert "%a%" in ti.ginTemplate
        assert "%coordsFrac%" in ti.ginTemplate

        nmc = store.get_preset("nmc111-cathode")
        assert nmc is not None
        assert "Li3Ni1Mn1Co1O6" in nmc.chemicalFormulas
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_preset_crud_operations():
    """Verify create, clone, update, and delete on presets."""
    temp_dir = Path(tempfile.mkdtemp(prefix="presets_crud_"))
    try:
        store = PresetStore(presets_dir=temp_dir)

        # Create
        new_preset = store.create_preset(
            PresetCreate(
                name="Custom LiFePO4",
                chemicalFormulas="Li1Fe1P1O4",
                minAtoms=7,
                maxAtoms=14,
                numInitial=15,
                popSize=15,
                maxNumStructures=60,
                optimizer="gulp",
                directRunCommand="gulp",
                ginTemplate="cell\n%a% %b% %c% %alphaDeg% %betaDeg% %gammaDeg%\nfrac\n%coordsFrac%\n",
            )
        )
        assert (temp_dir / f"{new_preset.id}.json").is_file()

        # Update
        updated = store.update_preset(new_preset.id, PresetUpdate(maxNumStructures=80))
        assert updated is not None
        assert updated.maxNumStructures == 80

        # Clone
        cloned = store.clone_preset(new_preset.id)
        assert cloned is not None
        assert "Copy" in cloned.name
        assert (temp_dir / f"{cloned.id}.json").is_file()

        # Delete
        deleted = store.delete_preset(new_preset.id)
        assert deleted
        assert not (temp_dir / f"{new_preset.id}.json").exists()
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_run_store_metadata_and_scaffolding():
    """Verify that experiments create runs/<exp_id>/ with meta.json and xtalopt.in."""
    temp_dir = Path(tempfile.mkdtemp(prefix="runs_test_"))
    try:
        store = RunStore(runs_dir=temp_dir)

        req = ExperimentCreateRequest(
            name="Lithium Cobalt Oxide Test",
            chemicalFormulas="Li1Co1O2",
            minAtoms=4,
            maxAtoms=8,
            numInitial=5,
            parentsPoolSize=5,
            maxNumStructures=25,
            optimizer="gulp",
            directRunCommand="gulp",
            ginTemplate="cell\n%a% %b% %c% %alphaDeg% %betaDeg% %gammaDeg%\nfrac\n%coordsFrac%\n",
            start_immediately=False,
        )

        meta = store.create_experiment(req)
        exp_id = meta["exp_id"]
        exp_dir = temp_dir / exp_id

        # Verify filesystem layout (No Database)
        assert exp_dir.is_dir()
        assert (exp_dir / "meta.json").is_file()
        assert (exp_dir / "xtalopt.in").is_file()
        assert (exp_dir / "templates" / "gulp" / "gin1").is_file()

        # Verify meta.json content
        meta_content = json.loads((exp_dir / "meta.json").read_text(encoding="utf-8"))
        assert meta_content["exp_id"] == exp_id
        assert meta_content["name"] == "Lithium Cobalt Oxide Test"
        assert meta_content["status"] == "idle"
        assert meta_content["chemicalFormulas"] == "Li1Co1O2"

        # List experiments
        experiments = store.list_experiments()
        assert len(experiments) == 1
        assert experiments[0].exp_id == exp_id
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
