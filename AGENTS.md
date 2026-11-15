# AGENTS.md — XtalOpt Web Workbench & Crystal Visualizer

## Project Vision
Build an end-to-end web frontend and orchestration platform on top of the official **XtalOpt** C++ CLI engine (`https://github.com/xtalopt/XtalOpt`, v15.0.0.rc0 master branch). 
The goal is to replace hand-editing `xtalopt.in` files, manual terminal monitoring, and external desktop visualization (Avogadro/VESTA) with a unified browser-based workbench tailored for battery material researchers.

We are targeting the **unmodified base XtalOpt repository first** to establish a rock-solid orchestration, monitoring, and 3D `.cif`/polyhedra visualization pipeline. Later, this architecture will cleanly support custom XtalOpt extensions (algebraic stoichiometry, mixed-site dopants, and MOME/MOQD grids).

---

## Core Architecture & Constraints
* **Decoupled Design (Do NOT modify XtalOpt's C++ Qt GUI):** XtalOpt runs in headless CLI mode (`./bin/xtalopt --cli`) inside isolated experiment directories.
* **No Automated Execution / Runtime Tests:** Do NOT attempt to compile XtalOpt, invoke `./bin/xtalopt`, or run GULP—the execution environment lives inside a separate Linux VM and all runtime verifications will be performed manually by the user. Focus strictly on code inspection, implementation, and static/syntax cleanliness.
* **Backend / Orchestrator:** Python (**FastAPI** + **SQLite** + **pymatgen** / **ASE** / **spglib**).
  * Translates web UI forms into `xtalopt.in` and optimizer template files (e.g., `templates/gulp/gin1`).
  * Spawns and manages `./bin/xtalopt --cli` subprocesses.
  * Watches `localWorkingDirectory` (`results.txt`, `xtalopt.state`, and individual structure directories) in real time.
  * Converts relaxed structures into standardized `.cif` strings (with space group detection and simulated XRD patterns).
* **Frontend:** **React (Vite + TypeScript + Tailwind CSS)** featuring:
  * **3Dmol.js** for interactive 3D crystal rendering (unit cell bounding box, supercells, ball-and-stick, and coordination polyhedra).
  * **Plotly.js** for energy convergence curves, convex hulls, and simulated XRD spectra.
  * **WebSockets / SSE** for live CLI logs and real-time population/status updates.

---

## Phased Implementation Plan

### Part 1: Repository Inspection & Base XtalOpt CLI Runner (Backend Foundation)
* Inspect the cloned `XtalOpt` repo (`schemes/commandLineInterface/`, `src/xtalopt/cliOptions.cpp`, and output file writers) to document exact `xtalopt.in` keys for v15 (`queueInterface = none`, `directRunCommand`, `ginTemplates`, etc.) and exact output files generated in `localWorkingDirectory`.
* Build a clean Python service (`backend/`) that can programmatically generate a valid `xtalopt.in` + `templates/gulp/gin1` inside an isolated `runs/<exp_id>/` folder, launch `./bin/xtalopt --cli`, capture stdout/stderr, and parse finished structures into JSON + `.cif`.

### Part 2: Experiment Configuration Studio & Preset Manager
* Build a SQLite schema and FastAPI CRUD endpoints for saving, cloning, and launching experiment configurations (composition formulas, `minAtoms`/`maxAtoms`, population size, optimizer type, GULP force-field templates, and reference energies).