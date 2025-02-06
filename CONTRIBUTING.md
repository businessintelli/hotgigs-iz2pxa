# Contributing to HotGigs

Thank you for your interest in contributing to HotGigs! This document provides comprehensive guidelines for contributing to our enterprise-grade recruitment management system.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Development Environment](#development-environment)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Pull Request Process](#pull-request-process)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Release Process](#release-process)

## Code of Conduct

### Expected Behavior

- Demonstrate empathy towards other contributors
- Use welcoming and inclusive language
- Be respectful of differing viewpoints
- Accept constructive criticism gracefully
- Focus on what's best for the community

### Unacceptable Behavior

- Use of sexualized language or imagery
- Trolling, insulting/derogatory comments
- Public or private harassment
- Publishing others' private information
- Other conduct which could be considered inappropriate

### Reporting Procedures

Report violations to conduct@hotgigs.com. All reports will be reviewed and investigated promptly and confidentially.

## Development Environment

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- TypeScript 5.0+
- Git
- VS Code (recommended)

### IDE Setup

1. Install VS Code extensions:
   - ESLint
   - Prettier
   - TypeScript and JavaScript Language Features
   - Tailwind CSS IntelliSense
   - Error Lens

2. Configure VS Code settings:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

### Environment Variables

1. Backend (.env):
```bash
SUPABASE_URL=<project-url>
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
OPENAI_API_KEY=<openai-key>
```

2. Frontend (.env.local):
```bash
VITE_SUPABASE_URL=<project-url>
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_API_URL=<api-url>
```

## Development Workflow

### Branch Naming Convention

- Feature: `feature/description-of-feature`
- Bugfix: `bugfix/description-of-bug`
- Hotfix: `hotfix/description-of-fix`
- Release: `release/version-number`

### Commit Message Format

Follow Conventional Commits specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting
- refactor: Code restructuring
- test: Adding tests
- chore: Maintenance

Example:
```
feat(auth): implement JWT refresh token mechanism

- Add token refresh endpoint
- Implement automatic token refresh
- Add tests for token refresh flow

Closes #123
```

### Code Review Checklist

- [ ] Code follows TypeScript strict mode guidelines
- [ ] Security best practices are followed
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] Accessibility requirements are met
- [ ] Performance impact is considered
- [ ] Error handling is implemented

## Coding Standards

### TypeScript Configuration

- Strict mode enabled
- No implicit any
- No unused locals/parameters
- Consistent casing enforced

### React Component Architecture

```typescript
// Component structure
import { FC, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface ComponentProps {
  // Props interface
}

export const Component: FC<ComponentProps> = memo(({ prop }) => {
  // Implementation
});
```

### State Management

- Use Tanstack Query for server state
- Implement optimistic updates
- Handle loading/error states
- Cache invalidation strategy

### Error Handling

```typescript
try {
  // Operation
} catch (error) {
  if (error instanceof AppError) {
    // Handle known error
  } else {
    // Log and handle unexpected error
  }
}
```

## Pull Request Process

1. Create PR using template:
```markdown
## Description
[Description of changes]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Security Considerations
- [ ] Security impact assessed
- [ ] No sensitive data exposed
- [ ] Dependencies scanned

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
```

2. CI/CD Pipeline Validation:
   - TypeScript compilation
   - ESLint checks
   - Unit tests
   - Integration tests
   - E2E tests
   - Security scans
   - Performance benchmarks

3. Review Requirements:
   - Two approvals required
   - Security review for sensitive changes
   - Performance review for critical paths

## Testing Guidelines

### Unit Testing (Vitest)

```typescript
describe('Component', () => {
  it('should render correctly', () => {
    // Test implementation
  });
});
```

### Integration Testing

```typescript
describe('API Integration', () => {
  it('should handle API responses', async () => {
    // Test implementation
  });
});
```

### E2E Testing (Cypress)

```typescript
describe('User Flow', () => {
  it('should complete end-to-end scenario', () => {
    // Test implementation
  });
});
```

### Coverage Requirements

- Statements: 90%
- Branches: 90%
- Functions: 90%
- Lines: 90%

## Documentation

### Code Documentation

```typescript
/**
 * Component description
 * @param props - Component props
 * @returns JSX element
 */
```

### API Documentation

- OpenAPI/Swagger specifications
- Request/response examples
- Error scenarios
- Rate limiting details

### Component Documentation

- Props interface
- Usage examples
- Accessibility considerations
- Performance implications

## Release Process

1. Version Numbering (SemVer):
   - Major: Breaking changes
   - Minor: New features
   - Patch: Bug fixes

2. Changelog Updates:
   - Added features
   - Fixed issues
   - Breaking changes
   - Migration guides

3. Release Notes:
   - Feature highlights
   - Security updates
   - Performance improvements
   - Known issues

4. Deployment Steps:
   - Database migrations
   - Edge function updates
   - Frontend deployment
   - CDN cache invalidation

For additional guidance, contact the development team through:
- GitHub Issues
- Technical Support: support@hotgigs.com
- Security Issues: security@hotgigs.com