# Backend Testing & Run Guidelines — XtalOpt Web Workbench

This document outlines how to install dependencies, run the FastAPI backend server, and test the structure parsing and configuration generation pipelines against real XtalOpt outputs.

---

## 1. Environment Setup

### Prerequisites
* Python 3.10+ (tested with Python 3.10 – 3.14)
* Virtual environment (recommended)

### Create & Activate Virtual Environment
```bash
# Inside the workingdir
python3 -m venv venv
source venv/bin/activate
```

### Install Dependencies
```bash
pip install -r backend/requirements.txt
```

> **Note on Fallback Mode**: The backend has zero-dependency fallback shims. The core parser and configuration generator can run with standard Python 3 even before installing `fastapi`, `pymatgen`, or `spglib`.

---

## 2. Inspecting Real Structure Files (CLI Verification)

A dedicated script [`inspect_structures.py`](file:///Users/HarishGM/Documents/Projects/batteryinformatics/workingdir/inspect_structures.py) is provided to parse and inspect real XtalOpt output files without running `./bin/xtalopt` or GULP:

```bash
python3 inspect_structures.py
```

### What It Inspects:
1. **Real `results.txt` table** (`XtalOpt/tests/sampledata/outputs/results.txt`):
   * Extracts ranking, structure tags (`1x1` through `2x3`), stoichiometry, enthalpies per atom, and space group numbers (`221`, `99`, `6`).
2. **Real `structure.state` Qt INI file** (`XtalOpt/tests/sampledata/outputs/structure.state`):
   * Extracts $3 \times 3$ Cartesian lattice matrix ($5 \times 5 \times 5 \text{ \AA}$), atomic species ($Z=22$ Ti, $Z=8$ O), coordinates, energy/enthalpy, and converts into a standardized `.cif` string.
3. **Real GULP relaxation output `xtal.got`** (`XtalOpt/tests/sampledata/formats/optimizerSamples/gulp/xtal.got`):
   * Extracts relaxed fractional coordinates, lattice vectors, lattice energy ($-78.44\text{ eV}$), and formats for 3Dmol.js rendering.

---

## 3. Running Automated Tests

Run the test suite across configuration generation, structure parsing, and process management:

```bash
python3 -c "
import sys
sys.path.insert(0, '.')
from backend.tests.test_config_generator import test_generate_xtalopt_in_content, test_create_experiment_workspace
from backend.tests.test_structure_parser import (
    test_parse_sample_results_txt,
    test_parse_sample_structure_state,
    test_lattice_geometry_calculations,
    test_structure_folder_parsing_and_cif_generation,
)
from backend.tests.test_process_manager import (
    test_process_manager_missing_workspace,
    test_process_manager_missing_bin,
    test_process_manager_idle_status,
)

test_generate_xtalopt_in_content()
test_create_experiment_workspace()
print('✓ Config generator tests passed')

test_parse_sample_results_txt()
test_parse_sample_structure_state()
test_lattice_geometry_calculations()
test_structure_folder_parsing_and_cif_generation()
print('✓ Structure parser tests passed against real sample data')

test_process_manager_missing_workspace()
test_process_manager_missing_bin()
test_process_manager_idle_status()
print('✓ Process manager tests passed')
"
```

Or using `pytest`:
```bash
pytest backend/tests/ -v
```

---

## 4. Running the FastAPI Backend Server

### Configuration Environment Variables
You can configure paths via environment variables or a `.env` file in the project root:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `XTALOPT_BIN_PATH` | `<root>/XtalOpt/bin/xtalopt` | Path to compiled `./bin/xtalopt` binary |
| `RUNS_DIR` | `<root>/runs` | Directory for isolated experiment workspaces |
| `GULP_BIN_PATH` | `gulp` | Path to GULP executable |
| `PORT` | `8000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind host address |

### Starting the Server
```bash
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

### Accessing Interactive Documentation
* **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 5. Testing API Endpoints

### A. Health Check
```bash
curl -X GET http://localhost:8000/api/health
```

### B. Generate Experiment Workspace (`xtalopt.in` + `gin1`)
```bash
curl -X POST http://localhost:8000/api/experiments/exp_001/generate \
  -H "Content-Type: application/json" \
  -d '{
    "chemical_formulas": "Ti2O4 - Ti4O8",
    "min_atoms": 2,
    "max_atoms": 12,
    "optimizer_cfg": {
      "queue_interface": "none",
      "optimizer": "gulp"
    }
  }'
```
Inspect the created workspace in `runs/exp_001/`:
* `runs/exp_001/xtalopt.in`
* `runs/exp_001/templates/gulp/gin1`
* `runs/exp_001/localWorkingDirectory/`

### C. Populate Sample Data & Inspect via API
You can test the structure endpoint immediately by copying sample data into an experiment directory:
```bash
mkdir -p runs/test_exp/localWorkingDirectory/00003x00007
cp XtalOpt/tests/sampledata/outputs/results.txt runs/test_exp/localWorkingDirectory/
cp XtalOpt/tests/sampledata/outputs/structure.state runs/test_exp/localWorkingDirectory/00003x00007/
```

Then query the API:
* **All Structures**:
  ```bash
  curl -X GET http://localhost:8000/api/runs/test_exp/structures
  ```
* **Specific Structure Tag (e.g. `3x7`)**:
  ```bash
  curl -X GET http://localhost:8000/api/runs/test_exp/structures/3x7
  ```
  Returns formula, volume, enthalpy per atom, space group, and standardized `.cif` string ready for 3Dmol.js.

### D. Process Execution & Log Streaming (Linux VM)
Inside the execution environment with compiled XtalOpt:
* **Start Run**: `POST /api/runs/<exp_id>/start`
* **Check Status**: `GET /api/runs/<exp_id>/status`
* **Tail Logs**: `GET /api/runs/<exp_id>/logs?tail=100`
* **Stop Run**: `POST /api/runs/<exp_id>/stop`

