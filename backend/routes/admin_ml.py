from __future__ import annotations

import os
import pathlib
import shutil

from fastapi import APIRouter, Form, HTTPException, Query, status

from backend.ml.rerank import MODEL_PATH, hot_reload_if_new

router = APIRouter(prefix="/admin/ml", tags=["admin-ml"])


def _expected_secret() -> str:
    return (os.getenv("ADMIN_ML_SECRET") or "").strip()


def _model_bucket() -> str:
    return (os.getenv("ML_MODEL_BUCKET") or "").strip()


def _guard(token: str) -> None:
    expected = _expected_secret()
    provided = (token or "").strip()

    if not expected or provided != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


@router.post("/promote")
def promote(
    token: str = Query(default=""),
    key: str | None = Query(default=None),
    form_key: str | None = Form(default=None, alias="key"),
):
    _guard(token)

    selected_key = (key or form_key or "").strip()
    if not selected_key:
        raise HTTPException(status_code=400, detail="Missing model key")

    bucket = _model_bucket()
    if not bucket:
        hot_reload_if_new()
        return {"ok": True, "model": selected_key, "promoted": False}

    try:
        import boto3
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"boto3 unavailable: {exc}") from exc

    tmp = pathlib.Path("/tmp/tmp_model.json")
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)

    try:
        s3 = boto3.client("s3")
        s3.download_file(bucket, selected_key, str(tmp))
        shutil.move(str(tmp), str(MODEL_PATH))
        hot_reload_if_new()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Promotion failed: {exc}") from exc

    return {"ok": True, "model": selected_key, "promoted": True}
