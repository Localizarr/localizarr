#!/bin/bash

# Build and tag Localizarr Docker image
# Usage: ./build.sh [push]
#   push: optionally push the image to Docker Hub after building

set -e


echo "Building Localizarr Docker image..."

# Build the Docker image from src directory
cd src
docker build -t vinicioslc/localizarr:latest .

echo "Successfully built and tagged image: vinicioslc/localizarr:latest"

# Show image info
echo "Image details:"
docker images vinicioslc/localizarr:latest

# Optional push
if [ "$1" = "push" ]; then
    echo "Pushing image to Docker Hub..."
    docker push vinicioslc/localizarr:latest
    echo "Successfully pushed vinicioslc/localizarr:latest"
fi