# Nightly Rerank Retraining

- Source: `analytics/train_rerank.py` pulls last-14-day `analytics.search_clicks`.
- Model: LightGBM LambdaMART (`objective=lambdarank`, `metric=ndcg`).
- Storage: JSON model uploaded to `s3://${ML_MODEL_BUCKET}/search_rerank_<ts>.json`.
- Promotion: GitHub Action calls `/admin/ml/promote?token=...&key=<object-key>`.
- Hot reload: `backend/ml/rerank.py` checks for newer model objects and refreshes local model file/cache.

## Environment Variables

| Var | Description |
|-----|-------------|
| `ML_MODEL_BUCKET` | S3 bucket for model artifacts |
| `ADMIN_ML_SECRET` | Shared secret for promote endpoint |
| `SUPABASE_URL_RW` | RW Postgres URL for click logs/features |
| `SMART_SEARCH_MODEL_PATH` | Optional local model path override |
| `SMART_SEARCH_MODEL_PREFIX` | Optional S3 object key prefix (default `search_rerank_`) |
| `SMART_SEARCH_MODEL_POLL_SECONDS` | Optional hot-reload poll interval in seconds |

## GitHub Secrets Needed

- `SUPABASE_URL_RW`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `ML_MODEL_BUCKET`
- `ADMIN_ML_SECRET`
- `BACKEND_URL` (example: `https://propnexus-backend.railway.app`)
