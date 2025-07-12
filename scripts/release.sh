#!/bin/bash

# Release script for otel-instrumentation-postgres
# Usage: ./scripts/release.sh [patch|minor|major]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "lib/package.json" ]; then
    print_error "This script must be run from the project root directory"
    exit 1
fi

# Check if version type is provided
if [ -z "$1" ]; then
    print_error "Please specify version type: patch, minor, or major"
    echo "Usage: $0 [patch|minor|major]"
    exit 1
fi

VERSION_TYPE=$1

# Validate version type
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    print_error "Invalid version type. Must be patch, minor, or major"
    exit 1
fi

print_status "Starting release process for version type: $VERSION_TYPE"

# Check if working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    print_error "Working directory is not clean. Please commit or stash your changes."
    exit 1
fi

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    print_warning "You're not on the main branch. Current branch: $CURRENT_BRANCH"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Run tests
print_status "Running tests..."
cd lib
npm test
cd ..

# Build the package
print_status "Building package..."
cd lib
npm run build
cd ..

# Bump version
print_status "Bumping version..."
cd lib
NEW_VERSION=$(npm version $VERSION_TYPE --no-git-tag-version)
cd ..

# Remove the 'v' prefix from version
NEW_VERSION=${NEW_VERSION#v}

print_status "New version: $NEW_VERSION"

# Create git tag
print_status "Creating git tag v$NEW_VERSION..."
git add .
git commit -m "chore: bump version to $NEW_VERSION"
git tag "v$NEW_VERSION"

# Push changes
print_status "Pushing changes and tag..."
git push origin main
git push origin "v$NEW_VERSION"

print_status "Release process completed!"
print_status "Version $NEW_VERSION has been tagged and pushed."
print_status "GitHub Actions will automatically publish to npm and create a release." 