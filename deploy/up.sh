#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

git pull --ff-only
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
