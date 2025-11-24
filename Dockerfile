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

# Frontend dependencies (Next.js app)
RUN cd frontend && npm ci

# Default to running the FastAPI backend via uvicorn
WORKDIR /app
EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
