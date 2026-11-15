"""FastAPI application entrypoint for XtalOpt Web Workbench."""

from contextlib import asynccontextmanager
import logging
import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router as api_router
from .services.telemetry_service import get_experiment_telemetry
from ..config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("xtalopt_workbench")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle event handler for startup and shutdown."""
    logger.info("Initializing %s v%s", settings.PROJECT_NAME, settings.VERSION)
    logger.info("Runs directory: %s", settings.RUNS_DIR)
    logger.info("XtalOpt binary: %s", settings.XTALOPT_BIN_PATH)
    yield
    logger.info("Shutting down %s", settings.PROJECT_NAME)


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Web Workbench and crystal visualizer backend for XtalOpt evolutionary crystal structure search."
    ),
    lifespan=lifespan,
)

# Configure CORS for local development and web frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs",
        "health_check": f"{settings.API_V1_STR}/health",
    }


@app.websocket("/ws/experiments/{exp_id}")
async def root_websocket_experiment_telemetry(websocket: WebSocket, exp_id: str):
    """Root WebSocket stream emitting real-time telemetry updates."""
    await websocket.accept()
    try:
        while True:
            try:
                data = get_experiment_telemetry(exp_id)
                await websocket.send_text(json.dumps(data))
            except Exception as e:
                logger.error("Error generating telemetry for WS %s: %s", exp_id, e)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        logger.info("Root WebSocket client disconnected for experiment %s", exp_id)
    except Exception as e:
        logger.warning("Root WebSocket error for %s: %s", exp_id, e)


