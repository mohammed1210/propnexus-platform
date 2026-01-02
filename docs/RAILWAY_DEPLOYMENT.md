# Railway Deployment Configuration

## Auto-Deploy Triggers

Railway auto-deploys when code is pushed to these branches:
- `main` - Production deployments
- `sprint-*` - Sprint feature branches
- `po*` - Product owner branches
- `copilot/*` - Copilot/AI assistant branches (temporary for testing)

## Manual Deployment

To manually trigger a Railway deployment:

### Option 1: GitHub Actions (Recommended)
1. Go to: https://github.com/mohammed1210/propnexus-platform/actions/workflows/deploy-backend.yml
2. Click "Run workflow"
3. Select your branch
4. Click "Run workflow"

### Option 2: Railway CLI
```bash
# Install Railway CLI
curl -fsSL https://railway.app/install.sh | sh

# Login
railway login

# Deploy
railway up --service "propnexus-backend"
```

### Option 3: Railway Dashboard
1. Go to: https://railway.app
2. Select the propnexus-backend service
3. Click "Deploy" → "Redeploy"

## Deployment Process

1. **Build**: Railway runs `pip3 install -r backend/requirements.txt && cd frontend && npm ci`
2. **Start**: Railway runs `uvicorn backend.main:app --host 0.0.0.0 --port 8000`
3. **Health Check**: Railway monitors `/health` endpoint
4. **Environment**: Python 3.12.3, Node production mode

## Verifying Deployment

After deployment, verify the backend is healthy:

```bash
curl https://propnexus-backend-production.up.railway.app/health
```

Expected response:
```json
{"status": "healthy"}
```

## Troubleshooting

### Deployment not triggering
- Check if your branch matches the trigger patterns in `.github/workflows/deploy-backend.yml`
- Verify Railway webhook is configured in GitHub repository settings
- Check Railway dashboard for deployment logs

### Build failures
- Check Railway logs in the dashboard
- Verify `requirements.txt` is up to date
- Ensure `railway.toml` configuration is correct

### Health check failures
- Verify `/health` endpoint is accessible
- Check environment variables are set in Railway
- Review application logs for startup errors

## Railway Configuration Files

- `railway.toml` - Main Railway configuration
- `backend/railway.json` - Legacy backend-specific config
- `.github/workflows/deploy-backend.yml` - GitHub Actions workflow

## Branch-Specific Deployments

Railway typically deploys from `main` branch to production. For testing PR changes:

1. **Recommended**: Merge to main after CI passes
2. **Alternative**: Use workflow_dispatch to manually deploy your branch
3. **Testing**: Use local environment or create a PR environment in Railway

## Environment Variables

Railway environment variables are managed in the Railway dashboard:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE` or `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- And others as needed

Never commit secrets to the repository!
