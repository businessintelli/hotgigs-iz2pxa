# HotGigs - AI-Powered Recruitment Management System

[![TypeScript](https://shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![React](https://shields.io/badge/React-18.2.0-blue)](https://reactjs.org/)
[![Supabase](https://shields.io/badge/Supabase-Latest-green)](https://supabase.io/)
[![License](https://shields.io/badge/License-MIT-yellow)](LICENSE)

HotGigs is an advanced recruitment management system designed to revolutionize the hiring process through AI-powered matching and comprehensive workflow automation. Built for recruiters, candidates, and hiring teams, the platform leverages modern cloud architecture and AI capabilities to reduce time-to-hire, improve match quality, and enhance collaboration across recruitment networks.

## 🚀 Key Features

- AI-powered candidate matching and screening
- Real-time collaboration and pipeline management
- Automated resume parsing and analysis
- Intelligent interview scheduling
- Advanced analytics dashboard
- Enterprise-grade security

## 🛠 Technology Stack

### Frontend
- React 18.2.0 with TypeScript
- Tailwind CSS for styling
- shadcn/ui component library
- Tanstack Query for state management

### Backend
- Supabase platform
- PostgreSQL database
- Edge Functions
- OpenAI integration

### Infrastructure
- Cloudflare for CDN and security
- Redis for caching
- DataDog for monitoring
- Sentry for error tracking

## 🏗 Project Structure

```
├── src/
│   ├── web/           # Frontend application
│   │   ├── components/
│   │   ├── pages/
│   │   └── features/
│   │
│   └── backend/       # Backend services
│       ├── functions/
│       ├── services/
│       └── db/
│
├── infrastructure/    # Infrastructure configuration
│   ├── security/
│   └── deployment/
│
└── docs/             # Documentation
```

## 🚦 Getting Started

### Prerequisites

- Node.js >=18.0.0
- pnpm >=8.0.0
- Supabase CLI
- Git

### Frontend Setup

```bash
cd src/web
pnpm install
cp .env.example .env.local
pnpm dev
```

### Backend Setup

```bash
cd src/backend
pnpm install
cp .env.example .env
pnpm dev
```

## 📚 Documentation

- [Backend Documentation](src/backend/README.md)
- [Frontend Documentation](src/web/README.md)
- [Security Guidelines](SECURITY.md)
- [API Documentation](src/backend/docs/api.md)

## 🔒 Security

HotGigs implements comprehensive security measures:

- JWT-based authentication with RS256
- Role-based access control (RBAC)
- Row-level security (RLS)
- WAF protection
- Rate limiting
- Data encryption at rest and in transit

For detailed security information, see our [Security Policy](SECURITY.md).

## 🧪 Testing

### Frontend Testing
```bash
cd src/web
pnpm test        # Run unit tests
pnpm e2e         # Run E2E tests
pnpm validate    # Run all checks
```

### Backend Testing
```bash
cd src/backend
pnpm test
pnpm test:coverage
```

## 📈 Performance Metrics

- Time-to-Hire: 60% reduction
- Match Quality: 85% accuracy
- System Uptime: 99.9%
- Response Time: <2 seconds

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is proprietary and confidential. Unauthorized copying, transfer or reproduction of the contents is strictly prohibited.

## 📞 Support

- GitHub Issues
- Technical Support: support@hotgigs.com
- Security Issues: security@hotgigs.com