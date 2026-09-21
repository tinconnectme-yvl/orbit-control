"""
Orbita-Control (Constellation Ops) - Mission Control Backend Application
Team «Я - Vector» // КосмоХакатон 2026
"""
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .config import FRONTEND_DIST_DIR
from .routers import scenarios, session, events, compare, diagnostics, export

app = FastAPI(
    title="ОРБИТА-КОНТРОЛ // ЦУП Спутниковой Группировки",
    description="Автономная система диспетчеризации спутниковой группировки командного центра «Team Я - Vector».",
    version="1.0.0"
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(scenarios.router)
app.include_router(session.router)
app.include_router(events.router)
app.include_router(compare.router)
app.include_router(diagnostics.router)
app.include_router(export.router)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Orbita-Control",
        "team": "Team Я - Vector",
        "version": "1.0.0"
    }

# Mount frontend build if available
if FRONTEND_DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST_DIR / "assets"), name="assets")
    
    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        # Serve static file if exists
        target = FRONTEND_DIST_DIR / full_path
        if target.is_file():
            return FileResponse(target)
        # Fallback to SPA index.html
        return FileResponse(FRONTEND_DIST_DIR / "index.html")
