"""Subprocess manager for XtalOpt CLI runs.

Spawns `./bin/xtalopt --cli` inside the isolated workspace,
tracks execution PID and status, captures stdout/stderr logs, and provides
clean stop/kill controls.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional, Tuple, List
import json
import logging
import os
import signal
import subprocess
import threading

import psutil

from ..schemas.run_schema import RunStatusResponse, RunLogsResponse
from ...config import settings

logger = logging.getLogger(__name__)


def to_wsl_path(path: Path) -> str:
    """Convert a Windows Path to a WSL mount path (/mnt/<drive>/...)."""
    resolved = path.resolve()
    path_str = str(resolved).replace("\\", "/")
    if len(path_str) >= 2 and path_str[1] == ":":
        drive = path_str[0].lower()
        return f"/mnt/{drive}{path_str[2:]}"
    return path_str


class ProcessState:
    """In-memory wrapper for a managed XtalOpt CLI subprocess."""

    def __init__(
        self,
        exp_id: str,
        workspace_dir: Path,
        process: Optional[subprocess.Popen] = None,
        pid: Optional[int] = None,
        start_time: Optional[datetime] = None,
    ):
        self.exp_id = exp_id
        self.workspace_dir = workspace_dir
        self.process = process
        self.pid = pid
        self.start_time = start_time or datetime.now(timezone.utc)
        self.end_time: Optional[datetime] = None
        self.status = "idle"
        self.exit_code: Optional[int] = None
        self.message: Optional[str] = None


class XtalOptProcessManager:
    """Manages spawning, tracking, stopping, and logging for XtalOpt CLI processes."""

    def __init__(self, runs_dir: Optional[Path] = None, bin_path: Optional[Path] = None):
        self._runs_dir = runs_dir
        self._bin_path = bin_path
        self._processes: Dict[str, ProcessState] = {}
        self._lock = threading.Lock()

    @property
    def runs_dir(self) -> Path:
        return self._runs_dir if self._runs_dir is not None else settings.RUNS_DIR

    @runs_dir.setter
    def runs_dir(self, val: Path) -> None:
        self._runs_dir = val

    @property
    def bin_path(self) -> Path:
        return self._bin_path if self._bin_path is not None else settings.XTALOPT_BIN_PATH

    @bin_path.setter
    def bin_path(self, val: Path) -> None:
        self._bin_path = val

    def _metadata_path(self, exp_id: str) -> Path:
        return self.runs_dir / exp_id / "meta.json"

    def _stdout_log_path(self, exp_id: str) -> Path:
        return self.runs_dir / exp_id / "stdout.log"

    def _stderr_log_path(self, exp_id: str) -> Path:
        return self.runs_dir / exp_id / "stderr.log"

    def _save_metadata(self, state: ProcessState) -> None:
        """Persist process execution metadata to meta.json."""
        path = self._metadata_path(state.exp_id)
        data = {}
        if path.is_file():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                data = {}

        data.update({
            "exp_id": state.exp_id,
            "status": state.status,
            "pid": state.pid,
            "exit_code": state.exit_code,
            "start_time": state.start_time.isoformat() if state.start_time else None,
            "end_time": state.end_time.isoformat() if state.end_time else None,
            "message": state.message,
        })
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        except Exception as e:
            logger.error("Failed to write metadata for %s: %s", state.exp_id, e)

    def _load_metadata(self, exp_id: str) -> Optional[ProcessState]:
        """Load persisted process state from disk if available."""
        path = self._metadata_path(exp_id)
        if not path.is_file():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            workspace_dir = self.runs_dir / exp_id
            state = ProcessState(
                exp_id=exp_id,
                workspace_dir=workspace_dir,
                pid=data.get("pid"),
                start_time=(
                    datetime.fromisoformat(data["start_time"])
                    if data.get("start_time")
                    else None
                ),
            )
            state.status = data.get("status", "idle")
            state.exit_code = data.get("exit_code")
            state.message = data.get("message")
            if data.get("end_time"):
                state.end_time = datetime.fromisoformat(data["end_time"])

            # Verify whether PID is still alive
            if state.status == "running" and state.pid:
                if not psutil.pid_exists(state.pid):
                    lwd_results = workspace_dir / "localWorkingDirectory" / "results.txt"
                    has_results = lwd_results.is_file() and lwd_results.stat().st_size > 0
                    if state.exit_code == 0 or (state.exit_code is None and has_results):
                        state.status = "completed"
                        state.exit_code = 0
                        state.message = "Run completed successfully."
                    else:
                        state.status = "failed"
                        state.message = "Process exited previously."
                    self._save_metadata(state)

            return state
        except Exception as e:
            logger.error("Failed to load metadata for %s: %s", exp_id, e)
            return None

    def start_run(
        self,
        exp_id: str,
        custom_args: Optional[List[str]] = None,
    ) -> RunStatusResponse:
        """Launch ./bin/xtalopt --cli inside runs/<exp_id>/ workspace."""
        workspace_dir = self.runs_dir / exp_id
        if not workspace_dir.is_dir():
            raise FileNotFoundError(
                f"Experiment workspace does not exist at {workspace_dir}. "
                f"Please generate config first."
            )

        xtalopt_in = workspace_dir / "xtalopt.in"
        if not xtalopt_in.is_file():
            raise FileNotFoundError(
                f"Required input deck xtalopt.in not found at {xtalopt_in}."
            )

        with self._lock:
            # Check if already running
            current_status = self.get_run_status(exp_id)
            if current_status.status == "running":
                return RunStatusResponse(
                    exp_id=exp_id,
                    status="running",
                    pid=current_status.pid,
                    start_time=current_status.start_time,
                    message=f"Run {exp_id} is already in progress (PID {current_status.pid}).",
                )

            # Ensure binary exists (or report descriptive error)
            if not self.bin_path.is_file():
                cand = settings.BASE_DIR / "xtalopt_latest" / "build" / "bin" / "xtalopt"
                if cand.is_file():
                    self.bin_path = cand
                else:
                    error_msg = (
                        f"XtalOpt binary not found at '{self.bin_path}'. "
                        f"Ensure XtalOpt is compiled or configure XTALOPT_BIN_PATH."
                    )
                    logger.error(error_msg)
                    raise FileNotFoundError(error_msg)

            # Prepare stdout/stderr log files
            stdout_path = self._stdout_log_path(exp_id)
            stderr_path = self._stderr_log_path(exp_id)
            stdout_file = open(stdout_path, "a", encoding="utf-8")
            stderr_file = open(stderr_path, "a", encoding="utf-8")

            # Timestamp log start
            now_iso = datetime.now(timezone.utc).isoformat()
            stdout_file.write(f"\n--- [XtalOpt Run Started: {now_iso}] ---\n")
            stdout_file.flush()

            # Construct CLI command: xtalopt --start -i xtalopt.in (line-buffered with stdbuf)
            if os.name == "nt":
                wsl_work = to_wsl_path(workspace_dir)
                wsl_bin = to_wsl_path(self.bin_path)
                cmd = ["wsl", "bash", "-c", f"cd '{wsl_work}' && stdbuf -oL -eL '{wsl_bin}' --start -i xtalopt.in"]
            else:
                cmd = ["stdbuf", "-oL", "-eL", str(self.bin_path), "--start", "-i", "xtalopt.in"]
            if custom_args:
                cmd.extend(custom_args)

            try:
                proc = subprocess.Popen(
                    cmd,
                    cwd=str(workspace_dir),
                    stdout=stdout_file,
                    stderr=stderr_file,
                    shell=False,
                )
            except Exception as e:
                stdout_file.close()
                stderr_file.close()
                logger.error("Failed to spawn XtalOpt process for %s: %s", exp_id, e)
                raise RuntimeError(f"Failed to start XtalOpt subprocess: {e}") from e

            state = ProcessState(
                exp_id=exp_id,
                workspace_dir=workspace_dir,
                process=proc,
                pid=proc.pid,
            )
            state.status = "running"
            state.message = f"XtalOpt started with PID {proc.pid}"
            self._processes[exp_id] = state
            self._save_metadata(state)

            return RunStatusResponse(
                exp_id=exp_id,
                status=state.status,
                pid=state.pid,
                start_time=state.start_time,
                message=state.message,
            )

    def stop_run(self, exp_id: str, timeout: int = 5) -> RunStatusResponse:
        """Gracefully terminate or kill a running XtalOpt subprocess."""
        with self._lock:
            state = self._processes.get(exp_id) or self._load_metadata(exp_id)
            if not state or not state.pid:
                return RunStatusResponse(
                    exp_id=exp_id,
                    status="idle",
                    message="No active or tracked run found for this experiment.",
                )

            pid = state.pid
            if not psutil.pid_exists(pid):
                state.status = "stopped"
                state.end_time = datetime.now(timezone.utc)
                state.message = f"Process {pid} was already terminated."
                self._save_metadata(state)
                return RunStatusResponse(
                    exp_id=exp_id,
                    status=state.status,
                    pid=pid,
                    start_time=state.start_time,
                    end_time=state.end_time,
                    message=state.message,
                )

            try:
                parent = psutil.Process(pid)
                # Terminate child processes first if any
                children = parent.children(recursive=True)
                for child in children:
                    try:
                        child.terminate()
                    except psutil.NoSuchProcess:
                        pass

                parent.terminate()
                _, alive = psutil.wait_procs([parent] + children, timeout=timeout)

                # Force kill if still alive
                for p in alive:
                    try:
                        p.kill()
                    except psutil.NoSuchProcess:
                        pass

                if os.name == "nt":
                    try:
                        subprocess.run(["wsl", "pkill", "-f", "xtalopt"], capture_output=True)
                    except Exception:
                        pass

                lwd_results = state.workspace_dir / "localWorkingDirectory" / "results.txt"
                has_results = lwd_results.is_file() and lwd_results.stat().st_size > 0

                state.status = "completed" if has_results else "stopped"
                state.exit_code = 0 if has_results else state.exit_code
                state.end_time = datetime.now(timezone.utc)
                state.message = f"Process {pid} completed and stopped." if has_results else f"Process {pid} successfully stopped."
                self._save_metadata(state)

            except psutil.NoSuchProcess:
                lwd_results = state.workspace_dir / "localWorkingDirectory" / "results.txt"
                has_results = lwd_results.is_file() and lwd_results.stat().st_size > 0
                state.status = "completed" if has_results else "stopped"
                state.exit_code = 0 if has_results else state.exit_code
                state.end_time = datetime.now(timezone.utc)
                state.message = f"Process {pid} had finished." if has_results else f"Process {pid} had already finished."
                self._save_metadata(state)
            except Exception as e:
                logger.error("Error stopping run %s (PID %s): %s", exp_id, pid, e)
                return RunStatusResponse(
                    exp_id=exp_id,
                    status="failed",
                    pid=pid,
                    message=f"Failed to stop process {pid}: {e}",
                )

            return RunStatusResponse(
                exp_id=exp_id,
                status=state.status,
                pid=pid,
                start_time=state.start_time,
                end_time=state.end_time,
                message=state.message,
            )

    def get_run_status(self, exp_id: str) -> RunStatusResponse:
        """Check live execution status and elapsed time."""
        state = self._processes.get(exp_id)
        if not state:
            state = self._load_metadata(exp_id)

        if not state:
            return RunStatusResponse(
                exp_id=exp_id,
                status="idle",
                message="No run found for this experiment.",
            )

        # Update live state from Popen object or PID check
        if state.process is not None:
            ret = state.process.poll()
            if ret is not None:
                state.exit_code = ret
                state.status = "completed" if ret == 0 else "failed"
                if not state.end_time:
                    state.end_time = datetime.now(timezone.utc)
                state.message = f"Process finished with exit code {ret}."
                self._save_metadata(state)
        elif state.status == "running" and state.pid:
            if not psutil.pid_exists(state.pid):
                # Process has ended. Check if structures were generated
                lwd_results = state.workspace_dir / "localWorkingDirectory" / "results.txt"
                has_results = lwd_results.is_file() and lwd_results.stat().st_size > 0

                if state.exit_code == 0 or (state.exit_code is None and has_results):
                    state.status = "completed"
                    state.message = "Run completed successfully."
                else:
                    state.status = "failed"
                    state.message = f"Process exited with code {state.exit_code}."
                if not state.end_time:
                    state.end_time = datetime.now(timezone.utc)
                self._save_metadata(state)

        elapsed = None
        if state.start_time:
            end = state.end_time or datetime.now(timezone.utc)
            elapsed = (end - state.start_time).total_seconds()

        return RunStatusResponse(
            exp_id=exp_id,
            status=state.status,
            pid=state.pid,
            exit_code=state.exit_code,
            start_time=state.start_time,
            end_time=state.end_time,
            elapsed_seconds=elapsed,
            message=state.message,
        )

    def get_run_logs(
        self,
        exp_id: str,
        tail: int = 200,
    ) -> RunLogsResponse:
        """Read stdout and stderr log files captured during the run."""
        stdout_path = self._stdout_log_path(exp_id)
        stderr_path = self._stderr_log_path(exp_id)

        stdout_lines: List[str] = []
        stderr_lines: List[str] = []
        total_stdout = 0
        total_stderr = 0

        if stdout_path.is_file():
            try:
                with open(stdout_path, "r", encoding="utf-8", errors="replace") as f:
                    all_out = f.readlines()
                    total_stdout = len(all_out)
                    stdout_lines = [line.rstrip("\r\n") for line in all_out[-tail:]]
            except Exception as e:
                stdout_lines = [f"[Error reading stdout.log: {e}]"]

        if stderr_path.is_file():
            try:
                with open(stderr_path, "r", encoding="utf-8", errors="replace") as f:
                    all_err = f.readlines()
                    total_stderr = len(all_err)
                    stderr_lines = [line.rstrip("\r\n") for line in all_err[-tail:]]
            except Exception as e:
                stderr_lines = [f"[Error reading stderr.log: {e}]"]

        return RunLogsResponse(
            exp_id=exp_id,
            stdout_lines=stdout_lines,
            stderr_lines=stderr_lines,
            total_stdout_lines=total_stdout,
            total_stderr_lines=total_stderr,
        )


# Global singleton instance
process_manager = XtalOptProcessManager()

