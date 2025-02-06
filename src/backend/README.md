# HotGigs Backend Services

Enterprise-grade backend services for the HotGigs recruitment platform built with Supabase, Edge Functions, and integrated AI capabilities.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Database](#database)
- [Services](#services)
- [Security](#security)
- [Monitoring](#monitoring)

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Supabase CLI
- PostgreSQL 14+
- Docker (for local development)

### Required Environment Variables

```bash
SUPABASE_URL=<project-url>
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
OPENAI_API_KEY=<openai-key>
SMTP_CONFIG=<smtp-json-config>
GOOGLE_CALENDAR_CREDENTIALS=<calendar-credentials>
```

## Getting Started

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. Start local development:
```bash
npm run dev
```

## Project Structure

```
src/
├── functions/          # Supabase Edge Functions
├── db/                 # Database migrations and seeds
├── services/          # Core business logic services
├── middleware/        # Custom middleware
├── utils/            # Utility functions
├── types/            # TypeScript type definitions
├── config/           # Configuration files
└── tests/            # Test suites
```

## Development

### Edge Functions Development

- Functions are deployed to Supabase Edge Network
- TypeScript with strict type checking
- Hot reload enabled during development
- Rate limiting and caching built-in

### Code Style

- ESLint configuration with strict rules
- Prettier for consistent formatting
- Husky pre-commit hooks

### Best Practices

- Use TypeScript strict mode
- Implement proper error handling
- Follow REST API conventions
- Document all public interfaces
- Write unit tests for critical paths

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Deployment

```bash
# Build project
npm run build

# Deploy Edge Functions
npm run deploy

# Database migrations
npm run migrate
```

## API Documentation

### Authentication

All endpoints require JWT authentication unless marked as public.

```typescript
headers: {
  Authorization: 'Bearer <jwt-token>'
}
```

### Rate Limiting

- 1000 requests/minute per IP
- 5000 requests/minute per authenticated user

### Error Responses

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

## Database

### Schema Management

- Migrations in `db/migrations`
- Seeds in `db/seeds`
- Row Level Security policies enforced

### Backup Strategy

- Automated daily backups
- Point-in-time recovery
- 30-day retention period

## Services

### OpenAI Integration

- GPT-4 for candidate matching
- Ada-002 for embeddings
- Automatic retry with exponential backoff

### Email Service

- Templated emails with MJML
- Queue-based sending
- Delivery tracking

### Calendar Integration

- Google Calendar API v3
- OAuth2 authentication
- Automatic timezone handling

## Security

### Authentication

- JWT-based authentication
- Role-based access control
- MFA support

### Data Protection

- Row Level Security
- AES-256 encryption at rest
- TLS 1.3 in transit

### Security Headers

```typescript
helmet({
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: true,
  dnsPrefetchControl: true,
  frameguard: true,
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: true,
  referrerPolicy: true,
  xssFilter: true
})
```

## Monitoring

### Logging

- Structured logging with Pino
- Log aggregation in DataDog
- Error tracking with Sentry

### Metrics

- Request latency
- Error rates
- Database performance
- Cache hit rates
- Edge Function execution time

### Alerts

- Service health
- Error thresholds
- Performance degradation
- Security incidents

## License

Private - All rights reserved

## Support

For technical support, contact the development team through:
- GitHub Issues
- Internal Slack channel (#hotgigs-backend)