# main.py  (repo root)
from __future__ import annotations

import logging
import os
import sys

logging.basicConfig(level=logging.INFO)
cwd = os.getcwd()
logging.info("CWD=%s", cwd)
logging.info("PYTHONPATH=%s", os.getenv("PYTHONPATH"))

# Ensure the repo root (e.g. /app) is on sys.path so `import backend` always works
root = os.path.dirname(os.path.abspath(__file__))
if root not in sys.path:
    sys.path.insert(0, root)
logging.info("Repo root on sys.path: %s", root in sys.path)
logging.info("Exists backend/main.py? %s", os.path.exists(os.path.join(root, "backend", "main.py")))

# Hand off to the real FastAPI app
from backend.main import app  # noqa: E402