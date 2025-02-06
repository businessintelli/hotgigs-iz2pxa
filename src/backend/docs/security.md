# HotGigs Platform Security Documentation
Version: 1.0.0

## Table of Contents
- [1. Authentication](#1-authentication)
- [2. Authorization](#2-authorization)
- [3. Data Security](#3-data-security)
- [4. Network Security](#4-network-security)
- [5. Compliance](#5-compliance)
- [6. Security Monitoring](#6-security-monitoring)
- [7. Incident Response](#7-incident-response)

## 1. Authentication

### 1.1 JWT Implementation
- Algorithm: RS256
- Token Expiry: 1 hour
- Issuer: hotgigs-platform
- Audience: hotgigs-users
- Clock Tolerance: 30 seconds
- Key Rotation: 90 days

### 1.2 Multi-Factor Authentication
- Required for admin and recruiter roles
- Device-based verification
- Session-based MFA persistence
- Backup codes support

### 1.3 Session Management
- Redis-based session storage
- 15-minute session timeout
- Device fingerprinting
- Concurrent session limits

## 2. Authorization

### 2.1 Role-Based Access Control
```typescript
enum UserRole {
  ADMIN = 'ADMIN',         // Full system access
  RECRUITER = 'RECRUITER', // Job and candidate management
  HIRING_MANAGER = 'HIRING_MANAGER', // Interview and feedback
  CANDIDATE = 'CANDIDATE', // Profile and applications
  GUEST = 'GUEST'         // Public access only
}
```

### 2.2 Permission Matrix
| Resource | Admin | Recruiter | Hiring Manager | Candidate | Guest |
|----------|-------|-----------|----------------|-----------|-------|
| Jobs | CRUD | CRUD | Read | Read | Read |
| Applications | CRUD | CRUD | Read/Update | Create/Read | - |
| Candidates | CRUD | Read/Update | Read | Self | - |
| Analytics | Full | Limited | Team | - | - |

### 2.3 Row Level Security
```sql
-- Jobs RLS Policy
CREATE POLICY "jobs_access_policy" ON jobs
USING (
  CASE 
    WHEN auth.role() = 'ADMIN' THEN true
    WHEN auth.role() = 'RECRUITER' THEN creator_id = auth.uid()
    ELSE status = 'PUBLISHED'
  END
);
```

## 3. Data Security

### 3.1 Encryption Standards
- Data at Rest: AES-256-GCM
- Data in Transit: TLS 1.3
- Key Length: 256 bits
- IV Length: 16 bytes
- Salt Length: 64 bytes

### 3.2 Data Classification
| Type | Classification | Protection |
|------|---------------|------------|
| User Credentials | Critical | Hash + Salt |
| PII Data | Sensitive | Encryption |
| Resume Data | Confidential | Encryption |
| Job Postings | Internal | In-Transit |
| Public Content | Public | None |

### 3.3 Storage Security
- Supabase Storage with RLS
- Signed URLs with 15-minute expiry
- File type validation
- Size limits: 10MB per file

## 4. Network Security

### 4.1 WAF Configuration
- ModSecurity with OWASP CRS
- Custom rules for API protection
- SQL injection prevention
- XSS protection
- Path traversal detection

### 4.2 Rate Limiting
```typescript
const RATE_LIMIT_CONFIG = {
  jobs: { windowMs: 3600000, max: 1000 },
  applications: { windowMs: 3600000, max: 2000 },
  auth: { windowMs: 900000, max: 50 },
  analytics: { windowMs: 3600000, max: 100 }
};
```

### 4.3 Security Headers
```typescript
const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};
```

## 5. Compliance

### 5.1 GDPR Compliance
- Data minimization
- Right to erasure
- Data portability
- Consent management
- Processing records

### 5.2 Security Controls
- Access logging
- Audit trails
- Data encryption
- Regular backups
- Incident response

### 5.3 Security Assessments
- Quarterly penetration testing
- Annual security audit
- Continuous vulnerability scanning
- Third-party assessments

## 6. Security Monitoring

### 6.1 Logging Strategy
```typescript
const securityLogger = new Logger({
  name: 'security-service',
  level: 'info',
  enableDatadog: process.env.NODE_ENV === 'production'
});
```

### 6.2 Metrics Collection
- Authentication attempts
- Rate limit violations
- Security incidents
- API usage patterns
- Error rates

### 6.3 Alerting Rules
- Failed authentication spikes
- Rate limit breaches
- Suspicious IP activity
- Error rate thresholds
- System availability

## 7. Incident Response

### 7.1 Response Procedures
1. Detection and Analysis
2. Containment
3. Eradication
4. Recovery
5. Post-Incident Review

### 7.2 Contact Information
- Security Team: security@hotgigs.com
- On-Call Engineer: oncall@hotgigs.com
- Incident Manager: incidents@hotgigs.com

### 7.3 Recovery Time Objectives
| Severity | Response Time | Resolution Time |
|----------|--------------|-----------------|
| Critical | 15 minutes | 2 hours |
| High | 30 minutes | 4 hours |
| Medium | 2 hours | 8 hours |
| Low | 4 hours | 24 hours |