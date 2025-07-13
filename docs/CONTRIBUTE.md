# CONTRIBUTE.md

## Project Structure

```
otel-instrumentation-postgres/
├── lib/                    # Main library
│   ├── src/               # Source code
│   ├── package.json       # Library package.json
│   └── README.md          # Library documentation
├── example/               # Example application
│   ├── src/              # Example source code
│   ├── docker-compose.yml # Example infrastructure
│   └── package.json      # Example package.json
└── README.md             # This file
```

## CI/CD

This project uses GitHub Actions for continuous integration and deployment:

### Workflows

- **Quality Assurance & Release** (`ci.yml`): Comprehensive pipeline that runs quality checks on every push/PR and handles releases on version tags (excludes example directory)

### Important Notes

- **Example directory changes do NOT trigger pipelines** - The example is for demonstration only
- **Only changes to the main library code** will trigger CI workflows
- **Version tags trigger the complete release process** regardless of what files changed

### Release Process

This project uses [semantic-release](https://semantic-release.gitbook.io/) for automated versioning and releases.

#### Automatic Releases

- **Every push to main** triggers semantic-release
- **Version bumping** is automatic based on commit messages
- **Changelog generation** is automatic
- **npm publishing** is automatic
- **GitHub releases** are automatic

#### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/) for automatic versioning:

- `feat:` → Minor version bump (new features)
- `fix:` → Patch version bump (bug fixes)
- `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `build:`, `ci:`, `chore:` → Patch version bump
- `BREAKING CHANGE:` → Major version bump

#### Manual Release (Optional. Run it in `lib`)

```bash
# Dry run (see what would be released)
npm run release:dry-run

# Actual release
npm run release
```

### Required Secrets

- `NPM_TOKEN`: Your npm authentication token for publishing

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request
