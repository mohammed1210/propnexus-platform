# Release Checklist

Use this checklist to ensure that each release is consistent, stable, and well documented. **Do not publish a release without completing every applicable step.**

1. **Update your branch** – Ensure your release branch is up to date with `main` and that all tests pass (CI is green).

2. **Version bump** – Update version numbers where necessary (e.g. `package.json`, `pyproject.toml`) and create a corresponding git tag (e.g. `vX.Y.Z`).

3. **Changelog** – Update `CHANGELOG.md` with a summary of the changes in this release.

4. **Smoke tests** – Before tagging, run local smoke tests against your dev deployment:
   - `bash scripts/verify-deploy.sh "$API_BASE"` – all endpoints should return status code 200.
   - Manually check key pages in the frontend (e.g. login, search, off‑market generator).

5. **Documentation** – Verify that new or updated features are documented in `docs/`. Ensure environment variables required by new code are added to `.env.example`.

6. **Tag and push** – Create a signed tag and push it to the remote:

   ```bash
   git tag -s vX.Y.Z -m "Release vX.Y.Z"
   git push origin vX.Y.Z
