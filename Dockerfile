# Multi-runtime image for backend (Python) and frontend (Next.js)

FROM python:3.12-slim AS base

WORKDIR /app

# Install system deps for Python builds and Node.js for frontend
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
  && rm -rf /var/lib/apt/lists/*

# Install Node.js (for frontend build and npm ci)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y nodejs \
  && rm -rf /var/lib/apt/lists/*

# Copy repository content
COPY . /app/.

# Backend dependencies
RUN python3 -m pip install --upgrade pip && \
    pip3 install -r backend/requirements.txt

# Install Playwright browser binaries (Chromium) needed at runtime.
# Note: this increases build time/size but is required for PLAYWRIGHT_ENABLE=true.
RUN python3 -m playwright install --with-deps chromium

# Frontend dependencies (Next.js app)
# Note: some Railway deploys exclude `frontend/` from the build context via `.railwayignore`.
# Guard this step so backend-only deploys still succeed.
RUN if [ -d frontend ]; then cd frontend && npm ci; else echo "frontend/ not present; skipping npm ci"; fi

# Default to running the FastAPI backend via uvicorn
WORKDIR /app
EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
