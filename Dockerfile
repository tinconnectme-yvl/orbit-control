# Multi-stage Dockerfile for Orbita-Control
# Stage 1: Build React Frontend SPA
FROM node:20-alpine AS frontend-builder
WORKDIR /build

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Python FastAPI Production Runtime
FROM python:3.10-slim AS runtime
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Install python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend application and CaseInfo1 models/data
COPY backend/ ./backend/
COPY CaseInfo1/ ./CaseInfo1/

# Copy built frontend assets
COPY --from=frontend-builder /build/dist ./frontend/dist

EXPOSE 8010

CMD ["python", "-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8010"]
