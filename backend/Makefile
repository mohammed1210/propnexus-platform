.PHONY: fmt lint test run verify

# Format Python code using black
fmt:
	black .

# Lint Python code using ruff
lint:
	ruff .

# Run Python tests using pytest
test:
	pytest -q

# Run the FastAPI application in development mode
run:
	uvicorn main:app --reload

# Verify a deployed backend using the verify-deploy script
verify:
	@if [ -z "$$API_BASE" ]; then \
		echo "Please set API_BASE to your deployed API base URL" && exit 1; \
	fi
	bash ../scripts/verify-deploy.sh "$$API_BASE"
