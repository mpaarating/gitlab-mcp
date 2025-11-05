# Contributing to GitLab MCP Server

Thank you for your interest in contributing to the GitLab MCP Server! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Quality](#code-quality)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project adheres to a code of conduct that promotes a respectful and inclusive environment. Please be kind and professional in all interactions.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm (comes with Node.js)
- GitLab account for testing
- Personal Access Token with `read_api` scope

### Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/mpaarating/gitlab-mcp.git
cd gitlab-mcp
```

2. **Install dependencies**

```bash
npm install
```

3. **Build the project**

```bash
npm run build
```

4. **Set up environment variables**

```bash
# Copy example file
cp .env.example .env

# Edit .env with your token
# GITLAB_TOKEN=glpat-your-token-here
```

Alternatively, export directly:

```bash
export GITLAB_TOKEN="your_token_here"
export GITLAB_BASE_URL="https://gitlab.com"  # Optional, for self-managed
```

5. **Run tests**

```bash
npm test
```

## Development Workflow

### Project Structure

```
src/
├── processors/        # Data transformation logic
├── services/          # GitLab API clients
├── tools/             # MCP tool handlers
├── types/             # TypeScript type definitions
└── utils/             # Shared utilities

tests/
├── unit/              # Unit tests
├── integration/       # Integration tests (coming soon)
└── fixtures/          # Test data
```

### Development Commands

```bash
# Development mode with hot reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Generate JSON Schema
npm run build:schema

# Run all quality checks
npm run check

# Type checking only
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check

# Testing
npm test
npm run test:watch
npm run test:coverage
```

## Testing

### Writing Tests

- **Unit Tests**: Place in `tests/unit/` and name with `.test.ts` extension
- **Integration Tests**: Place in `tests/integration/` (coming soon)
- **Fixtures**: Add test data to `tests/fixtures/`

### Test Guidelines

1. Use descriptive test names that explain the behavior
2. Follow the **Arrange-Act-Assert** pattern
3. Test both success and failure cases
4. Use fixtures for complex test data
5. Mock external dependencies (GitLab API, etc.)

### Example Test

```typescript
import { describe, it, expect } from "vitest";
import { applyFilters } from "../../src/processors/filter.js";

describe("filter", () => {
  it("should filter out system notes by default", () => {
    const comments = [
      /* test data */
    ];
    const filtered = applyFilters(comments, {
      includeSystem: false,
      onlyResolved: false,
      onlyUnresolved: false,
    });

    expect(filtered.every((c) => !c.system)).toBe(true);
  });
});
```

### Coverage Goals

- **Minimum**: 80% coverage for all metrics
- **Target**: 90%+ coverage for critical paths
- **Run**: `npm run test:coverage` to check

## Code Quality

### TypeScript

- Use strict TypeScript settings
- Define explicit return types for functions
- Avoid `any` types
- Use interfaces for public APIs
- Use type inference for simple cases

### Code Style

- Follow the existing code style
- Use meaningful variable and function names
- Keep functions small and focused
- Add JSDoc comments for public APIs
- Avoid deep nesting

### Linting and Formatting

Before committing, ensure:

```bash
npm run check  # Runs typecheck + lint + format:check
```

All checks must pass before submitting a PR.

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes
- `perf`: Performance improvements
- `ci`: CI/CD changes

### Examples

```bash
feat(filter): add support for filtering by file path

Add file_path parameter to filter comments by specific files.
This is useful for agents focusing on specific file reviews.

Closes #42
```

```bash
fix(retry): handle timeout errors correctly

Timeout errors were not being retried. This adds ETIMEDOUT
and ECONNABORTED to the list of retryable error codes.
```

```bash
test(normalizer): add tests for position extraction

Add comprehensive tests for extracting file paths from
GitLab position objects, including edge cases.
```

## Pull Request Process

### Before Submitting

1. ✅ All tests pass (`npm test`)
2. ✅ Code is formatted (`npm run format`)
3. ✅ Linting passes (`npm run lint`)
4. ✅ Type checking passes (`npm run typecheck`)
5. ✅ Coverage meets minimum threshold
6. ✅ Documentation is updated (if needed)
7. ✅ CHANGELOG.md is updated (for user-facing changes)

### PR Checklist

- [ ] Branch is up to date with `main`
- [ ] Tests added/updated for new functionality
- [ ] Documentation updated (README, QUICKSTART, etc.)
- [ ] CHANGELOG.md updated
- [ ] All CI checks pass
- [ ] Self-review completed
- [ ] Screenshots/examples added (if UI/output changes)

### PR Title Format

Use conventional commit format:

```
feat: Add support for filtering by file path
fix: Handle timeout errors in retry logic
docs: Update quickstart guide with new examples
```

### Review Process

1. Submit PR with clear description
2. Address review feedback promptly
3. Keep PR scope focused
4. Request re-review after changes
5. Squash commits before merge (if requested)

## Architecture Decisions

### Read-Only Guarantee

This server is **strictly read-only**. Any contributions that add write capabilities will be rejected. The read-only guarantee is enforced at multiple levels:

1. Code: GitLab client only implements GET methods
2. Types: No write method signatures
3. Docs: Clear documentation of read-only nature
4. Tests: Integration tests verify no writes occur

### Error Handling

All errors must:

- Be mapped to MCP-compatible errors
- Include remediation hints for users
- Be logged with correlation IDs
- Preserve stack traces in DEBUG mode

### Performance Considerations

- Use pagination for all GitLab API calls
- Implement retry logic for transient failures
- Add correlation IDs for request tracking
- Log performance metrics

## Questions?

If you have questions about contributing:

- Open a [GitHub Discussion](https://github.com/mpaarating/gitlab-mcp/discussions)
- Check existing [Issues](https://github.com/mpaarating/gitlab-mcp/issues)
- Review the [README](README.md) and [QUICKSTART](QUICKSTART.md)

Thank you for contributing! 🎉
