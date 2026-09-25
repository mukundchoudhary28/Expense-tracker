#!/usr/bin/env bash
# Usage: bash deploy.sh <image-tag>
set -euo pipefail

NEW_TAG="$1"
cd /home/ubuntu/expense-tracker

# Load REGISTRY and other settings
set -a
source .env
set +a

# Record the version being deployed, so later compose commands
# (and restarts) keep using it
if grep -q '^IMAGE_TAG=' .env; then
  sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${NEW_TAG}/" .env
else
  echo "IMAGE_TAG=${NEW_TAG}" >> .env
fi
export IMAGE_TAG="$NEW_TAG"

echo "Logging into ECR..."
aws ecr get-login-password --region ap-south-1 \
  | docker login --username AWS --password-stdin "$REGISTRY"

echo "Pulling images for ${NEW_TAG}..."
docker compose pull backend frontend

echo "Starting containers..."
docker compose up -d --no-build

echo "Cleaning up old images..."
docker image prune -f

echo "Deployed ${NEW_TAG}"