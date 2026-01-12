#!/bin/bash

# Build and tag Localizarr Docker image
# Usage: ./build.sh [push]
#   push: optionally push the image to Docker Hub after building

set -e

IMAGE_NAME="vinicioslc/localizarr"
TAG="latest"

echo "Building Localizarr Docker image..."

# Build the Docker image from src directory
cd src
docker build -t ${IMAGE_NAME}:${TAG} .

echo "Successfully built and tagged image: ${IMAGE_NAME}:${TAG}"

# Show image info
echo "Image details:"
docker images ${IMAGE_NAME}:${TAG}

# Optional push
if [ "$1" = "push" ]; then
    echo "Pushing image to Docker Hub..."
    docker push ${IMAGE_NAME}:${TAG}
    echo "Successfully pushed ${IMAGE_NAME}:${TAG}"
fi