# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial implementation of GitLab MCP Server
- `gitlab_get_mr_comments` tool for fetching MR comments
- Support for inline discussions and overview notes
- Filtering by resolution status (resolved/unresolved)
- System note filtering
- Dual output formats (JSON and Markdown)
- Comprehensive error handling with remediation hints
- Retry logic with exponential backoff
- Structured logging with secret redaction
- Support for self-managed GitLab instances
- Pagination handling (automatic fetch of all pages)
- Read-only architecture (GET requests only)
- Complete documentation and examples

### Security
- Read-only design (no write operations)
- Token scope recommendation (`read_api`)
- Automatic secret redaction in logs
- No data persistence (in-memory only)

## [0.1.0] - 2025-11-05

### Added
- Initial project setup
- Core architecture implementation
- MCP server integration
- GitLab API client (read-only)
- Comment normalization and filtering
- Markdown digest generation
- Comprehensive test suite
- Documentation (README, PRD, System Design)
- Example requests and responses
- JSON Schema export

[Unreleased]: https://github.com/mpaarating/gitlab-mcp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mpaarating/gitlab-mcp/releases/tag/v0.1.0

