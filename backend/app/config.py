"""
Backend configuration and path settings for Orbita-Control.
"""
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent
CASE_INFO_DIR = PROJECT_ROOT / "CaseInfo1"
DATA_DIR = CASE_INFO_DIR / "data"
MODEL_DIR = CASE_INFO_DIR / "model"
EXAMPLES_DIR = CASE_INFO_DIR / "examples"

FRONTEND_DIST_DIR = PROJECT_ROOT / "frontend" / "dist"

DEFAULT_PORT = 8010
DEFAULT_HOST = "127.0.0.1"
