# main.py (repo root) — robust shim to expose backend.main:app
from __future__ import annotations

import importlib.util
import logging
import os
import sys
from types import ModuleType

logging.basicConfig(level=logging.INFO)
root = os.path.dirname(os.path.abspath(__file__))  # e.g. /app
logging.info("CWD=%s", os.getcwd())
logging.info("PYTHONPATH=%s", os.getenv("PYTHONPATH"))
logging.info("Exists backend/main.py? %s", os.path.exists(os.path.join(root, "backend", "main.py")))
logging.info("Exists backend/__init__.py? %s", os.path.exists(os.path.join(root, "backend", "__init__.py")))

# Ensure repo root on sys.path (nice to have)
if root not in sys.path:
    sys.path.insert(0, root)

# --- synthesize a real "backend" package so absolute imports work
backend_dir = os.path.join(root, "backend")
if "backend" not in sys.modules:
    pkg = ModuleType("backend")
    pkg.__file__ = os.path.join(backend_dir, "__init__.py")
    pkg.__path__ = [backend_dir]  # type: ignore[attr-defined]
    sys.modules["backend"] = pkg

# Load backend/main.py as module "backend.main"
spec = importlib.util.spec_from_file_location("backend.main", os.path.join(backend_dir, "main.py"))
if not spec or not spec.loader:
    raise RuntimeError("Could not create spec for backend.main")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)  # type: ignore[attr-defined]
logging.info("Loaded backend.main via file path")
logging.info("ROOT SHIM VERSION: 2025-10-09T12:xxZ")

# Expose FastAPI app for `uvicorn main:app`
app = getattr(mod, "app", None)
if app is None:
    raise RuntimeError("backend.main did not expose 'app'")
