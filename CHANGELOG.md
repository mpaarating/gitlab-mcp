# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2025-11-05

### Fixed
- **Critical**: `.env` file now loads correctly from project root regardless of current working directory
- Fixes issue where MCP clients starting the server from different directories couldn't find `.env`
- Config module now explicitly resolves path to project root for reliable `.env` loading

## [0.1.1] - 2025-11-05

### Added

- Test connection script (`npx tsx scripts/test-connection.ts`) to verify GitLab setup before configuration
- New npm scripts: `start:dev` (build and start) and `inspector` (debug mode)
- Status badges in README (CI, License, TypeScript, Node.js versions)
- Step-by-step test connection guide in QUICKSTART.md

### Fixed

- **Critical**: Added `dotenv` support to automatically load `.env` files
- Users can now use `.env` files without manually exporting environment variables
- Configuration now works out of the box with `.env` file

### Changed

- Updated QUICKSTART.md with connection test step
- Improved error messages in test connection script with specific troubleshooting tips
- Enhanced README with development section

## [0.1.0] - 2025-11-05

### Added

- Initial release of GitLab MCP Server
- Read-only MCP server for retrieving GitLab merge request comments
- Single tool: `gitlab_get_mr_comments`
- Support for inline discussions and overview notes
- Advanced filtering options (resolved, unresolved, system notes)
- Dual output formats (JSON and Markdown)
- Comprehensive test suite (40 unit tests)
- CI/CD pipeline with GitHub Actions
- Complete documentation (README, QUICKSTART, CONTRIBUTING, SECURITY)
- JSON Schema exports for API consumers

### Security

- Read-only guarantee enforced at code, type, and API levels
- Token redaction in logs
- Comprehensive security documentation

[0.1.2]: https://github.com/mpaarating/gitlab-mcp/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/mpaarating/gitlab-mcp/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/mpaarating/gitlab-mcp/releases/tag/v0.1.0
