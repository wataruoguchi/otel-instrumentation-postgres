# CI/CD Setup Guide

This guide will help you set up automated testing, building, and publishing for the `otel-instrumentation-postgres` package.

## Prerequisites

1. **GitHub Repository**: Your code should be pushed to GitHub
2. **npm Account**: You need an npm account to publish packages
3. **GitHub Actions**: Enabled on your repository

## Step 1: Create npm Token

1. Go to [npmjs.com](https://www.npmjs.com) and log in
2. Click on your profile picture → "Access Tokens"
3. Click "Generate New Token"
4. Select "Automation" token type
5. Copy the generated token (you won't see it again!)

## Step 2: Add npm Token to GitHub Secrets

1. Go to your GitHub repository
2. Click "Settings" → "Secrets and variables" → "Actions"
3. Click "New repository secret"
4. Name: `NPM_TOKEN`
5. Value: Paste your npm token from Step 1
6. Click "Add secret"

## Step 3: Verify GitHub Actions Workflows

The following workflows are configured:

### `ci.yml` - Continuous Integration
- **Triggers**: Push to main, pull requests (excludes example directory)
- **Actions**: Runs tests, linting, and builds
- **Purpose**: Ensures code quality on every change

### `release.yml` - Release Pipeline
- **Triggers**: Version tags (e.g., `v1.0.0`) (excludes example directory)
- **Actions**: Tests, builds, publishes to npm, creates GitHub release
- **Purpose**: Complete release automation

### Important Notes
- **Example directory changes do NOT trigger pipelines** - The example is for demonstration only
- **Only changes to the main library code** will trigger CI workflows
- **Version tags trigger the complete release process** regardless of what files changed

## Step 4: Test the Setup

1. **Push your code**:
   ```bash
   git add .
   git commit -m "feat: add CI/CD workflows"
   git push origin main
   ```

2. **Check GitHub Actions**: Go to your repository → "Actions" tab
3. **Verify the CI workflow runs** and all tests pass

## Step 5: Make Your First Release

### Option A: Using the Release Script (Recommended)

```bash
# For a patch release (1.0.0 → 1.0.1)
npm run release:patch

# For a minor release (1.0.0 → 1.1.0)
npm run release:minor

# For a major release (1.0.0 → 2.0.0)
npm run release:major
```

### Option B: Manual Release

```bash
# 1. Bump version in lib/package.json
cd lib
npm version patch  # or minor/major
cd ..

# 2. Commit and tag
git add .
git commit -m "chore: bump version to X.Y.Z"
git tag vX.Y.Z

# 3. Push
git push origin main
git push origin vX.Y.Z
```

## What Happens During Release

1. **Tests Run**: All tests must pass
2. **Package Builds**: TypeScript compilation and bundling
3. **npm Publish**: Package is published to npm registry
4. **GitHub Release**: Release notes are created automatically

## Troubleshooting

### Common Issues

**"npm publish failed"**
- Check that `NPM_TOKEN` secret is set correctly
- Verify your npm account has permission to publish
- Ensure package name is available on npm

**"Tests failing"**
- Run tests locally: `npm test`
- Check for linting issues: `npm run lint`
- Fix any failing tests before releasing

**"Build failing"**
- Check TypeScript compilation: `npm run build`
- Verify all dependencies are installed
- Check for missing files in the build

**"Pipeline not triggering"**
- Ensure you're not only changing files in the `example/` directory
- Check that your changes are in the `lib/` directory or root files
- Verify you're pushing to the main branch

### Getting Help

1. Check the GitHub Actions logs for detailed error messages
2. Verify all secrets are set correctly
3. Ensure you're on the main branch when releasing
4. Check that the working directory is clean

## Best Practices

1. **Always test locally** before pushing
2. **Use semantic versioning** (patch/minor/major)
3. **Write good commit messages** for better release notes
4. **Review the generated release notes** before publishing
5. **Test the published package** in a new project
6. **Keep example changes separate** from library changes

## Security Notes

- Never commit the `NPM_TOKEN` to your repository
- Use GitHub Secrets for all sensitive data
- Regularly rotate your npm tokens
- Review GitHub Actions permissions

## Next Steps

After your first successful release:

1. **Monitor the package**: Check npm downloads and GitHub stars
2. **Respond to issues**: Set up issue templates and contribution guidelines
3. **Documentation**: Keep README and examples up to date
4. **Community**: Engage with users and contributors 