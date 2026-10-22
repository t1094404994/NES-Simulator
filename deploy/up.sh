#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

git pull --ff-only
# This host has no buildx. The classic builder is the one that actually runs.
export COMPOSE_BAKE=false
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
# The site config is a bind mount. Compose will not restart nginx when only that file changes.
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate --no-deps nginx
