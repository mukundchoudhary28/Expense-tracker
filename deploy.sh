#!/usr/bin/env bash
# Usage: bash deploy.sh <image-tag>
set -euo pipefail

IMAGE_TAG="$1"
cd /home/ubuntu/expense-tracker

# Load REGISTRY and DOMAIN
set -a
source .env
set +a

# Record the deployed version in .env, so later compose commands
# (and restarts) keep using it
if grep -q '^IMAGE_TAG=' .env; then
  sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${IMAGE_TAG}/" .env
else
  echo "IMAGE_TAG=${IMAGE_TAG}" >> .env
fi

echo "Logging into ECR..."
aws ecr get-login-password --region ap-south-1 \
  | docker login --username AWS --password-stdin "$REGISTRY"

echo "Pulling images for ${IMAGE_TAG}..."
docker compose pull backend frontend

echo "Starting containers..."
docker compose up -d --no-build

echo "Cleaning up old images..."
docker image prune -f

echo "Deployed ${IMAGE_TAG}"