# main.py (repo root) — robust shim
from __future__ import annotations

import importlib
import importlib.util
import logging
import os
import sys
from types import ModuleType
from typing import Optional

logging.basicConfig(level=logging.INFO)
cwd = os.getcwd()
logging.info("CWD=%s", cwd)
logging.info("PYTHONPATH=%s", os.getenv("PYTHONPATH"))

# Ensure repo root is on sys.path (so `import backend` can work)
root = os.path.dirname(os.path.abspath(__file__))  # /app in Railway
if root not in sys.path:
    sys.path.insert(0, root)
logging.info("Exists backend/main.py? %s", os.path.exists(os.path.join(root, "backend", "main.py")))
logging.info("Exists backend/__init__.py? %s", os.path.exists(os.path.join(root, "backend", "__init__.py")))

def _load_backend_main_via_import() -> Optional[ModuleType]:
    try:
        return importlib.import_module("backend.main")
    except Exception as e:
        logging.warning("Normal import backend.main failed: %r", e)
        return None

def _load_backend_main_via_path() -> Optional[ModuleType]:
    try:
        backend_main_path = os.path.join(root, "backend", "main.py")
        spec = importlib.util.spec_from_file_location("backend.main", backend_main_path)
        if spec and spec.loader:
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)  # type: ignore[attr-defined]
            logging.info("Loaded backend.main via file path")
            return mod
    except Exception as e:
        logging.error("Path import of backend.main failed: %r", e)
    return None

_mod = _load_backend_main_via_import() or _load_backend_main_via_path()
if not _mod:
    # Crash loudly so Railway shows a clear cause
    raise RuntimeError("Could not import backend.main by package or by file path")

# Hand through the FastAPI app for `uvicorn main:app`
app = getattr(_mod, "app", None)
if app is None:
    raise RuntimeError("backend.main did not expose 'app'")
