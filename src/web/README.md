# HotGigs Web Frontend

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2%2B-blue)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.3%2B-blue)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-4.4%2B-blue)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Latest-green)](https://supabase.io/)
[![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-Latest-purple)](https://ui.shadcn.com/)

Enterprise-grade React application for the HotGigs recruitment management system, providing advanced candidate matching, real-time collaboration, and comprehensive pipeline management capabilities.

## Key Features

- 🤖 AI-powered candidate matching and screening
- ⚡️ Real-time collaboration and updates
- 📊 Advanced recruitment pipeline management
- 🔒 Enterprise-grade security measures
- ♿️ WCAG 2.1 AA accessibility compliance
- 📱 Responsive design across all devices

## Tech Stack

### Core Technologies
- React 18.2.0 - Modern UI development with concurrent features
- TypeScript 5.0.0 - Type-safe development environment
- Tailwind CSS 3.3.3 - Utility-first styling framework
- shadcn/ui - Accessible component library
- Vite 4.4.0 - Next-generation frontend tooling

### State Management & Data Fetching
- @tanstack/react-query 4.0.0 - Server state management
- @supabase/supabase-js 2.38.0 - Real-time data synchronization
- Zustand - Complex state workflows

### Form Handling & Validation
- react-hook-form 7.0.0 - Performance-focused forms
- zod 3.0.0 - Schema validation
- @hookform/resolvers 3.0.0 - Form validation integration

### Testing Infrastructure
- Vitest 0.34.0 - Unit and integration testing
- Cypress 13.0.0 - End-to-end testing
- @testing-library/react 14.0.0 - Component testing
- MSW - API mocking

## Getting Started

### Prerequisites

- Node.js >=18.0.0
- pnpm >=8.0.0
- Git >=2.0.0
- VS Code (recommended)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/hotgigs.git
cd hotgigs/web
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Start the development server:
```bash
pnpm dev
```

### Environment Variables

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=your-api-url
VITE_SENTRY_DSN=your-sentry-dsn
VITE_DATADOG_APP_ID=your-datadog-app-id
VITE_ENVIRONMENT=development
```

## Development

### Available Scripts

- `pnpm dev` - Start development server with HMR
- `pnpm build` - Build production bundle
- `pnpm preview` - Preview production build
- `pnpm lint` - Run ESLint
- `pnpm format` - Run Prettier
- `pnpm type-check` - Run TypeScript checks
- `pnpm test` - Run Vitest tests
- `pnpm e2e` - Run Cypress E2E tests
- `pnpm analyze` - Analyze bundle size
- `pnpm validate` - Run all checks
- `pnpm clean` - Clean build artifacts

### Code Style

We follow strict coding standards to maintain high-quality, consistent code:

- ESLint with TypeScript and React rules
- Prettier for consistent formatting
- Strict TypeScript configuration
- Component patterns following Atomic Design
- Performance optimization with React.memo
- Comprehensive error boundaries

## Testing

### Unit & Integration Tests

- Framework: Vitest
- Coverage targets:
  - Statements: 80%
  - Branches: 80%
  - Functions: 80%
  - Lines: 80%

### E2E Testing

- Framework: Cypress
- Key flows tested:
  - User authentication
  - Job posting workflow
  - Candidate management
  - Interview scheduling

## Deployment

### Environments

- Development: Local development server
- Staging: Cloudflare Preview Deployments
- Production: Cloudflare Pages Production

### Build Process

```bash
pnpm build
```

Optimizations:
- Code splitting
- Tree shaking
- Image optimization
- CSS minification
- Dead code elimination

### Monitoring

- Error tracking: Sentry
- Performance: DataDog RUM
- Analytics: Custom events tracking

## Project Structure

```
src/
├── components/       # Reusable UI components
├── pages/           # Page components and routes
├── lib/             # Utilities and custom hooks
├── types/           # TypeScript type definitions
├── contexts/        # React context providers
├── styles/          # Global styles and themes
├── tests/           # Test suites and utilities
├── api/             # API integration layer
├── constants/       # Application constants
└── features/        # Feature-based modules
```

## Contributing

Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and development process.

## License

This project is proprietary and confidential. Unauthorized copying, transfer or reproduction of the contents is strictly prohibited.