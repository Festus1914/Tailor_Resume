# Security & Production Deployment Guide

## Overview

This document covers security best practices, testing, and production deployment for Resume Tailor.

## 1. Authentication Security

### ✅ Implemented
- **Password Hashing**: Argon2id with OWASP parameters (19 MiB, 2 iterations, 1 lane)
- **Session Management**: Server-side opaque tokens, no self-contained JWTs
- **Session Validation**: Re-checked on every request against database
- **Account Lockout**: Escalating lockout (15min → 1hr → 24hr) after 5 failed attempts
- **Timing Attack Prevention**: Fake password verification for non-existent accounts
- **Secure Cookies**: HTTP-only, Secure, SameSite=Lax
- **Session Expiry**: 7-day sliding window with 25% threshold for extension
- **Cookie Prefix**: `__Host-` in production (enforces HTTPS, no Domain, Path=/)

### Configuration

**`.env.local` secrets:**
```bash
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=<32-byte-hex>

# Bootstrap admin account
ADMIN_EMAIL=your-email@example.com

# API keys (kept out of version control)
ANTHROPIC_API_KEY=sk-ant-...
MONGODB_URI=mongodb+srv://user:pass@cluster...
```

## 2. Authorization Checks

### ✅ Implemented

**Route Protection Layers:**
1. **Middleware** (Next.js Edge) - Cookie check, redirect to login
2. **Guards** (Database) - Re-verify session, check role
3. **API Routes** - requireUser(), requireAdmin()
4. **Component Guards** - Conditional rendering (UI only, not security)

**Key Patterns:**
```typescript
// Require authenticated user
const { user } = await requireUser();

// Require admin role
const { user } = await requireAdmin();

// Check ownership
assertOwnership(resourceUserId, user._id);

// Non-existent vs. forbidden
// Use 404 for both "not found" and "not yours" to prevent enumeration
```

## 3. Input Validation

### ✅ Implemented

**Every API endpoint validates with Zod:**
- Email format validation
- URL validation and normalization
- String length limits
- Enum restrictions (status, role, etc.)
- Number bounds (quota limits, pagination)

**Example:**
```typescript
const schema = z.object({
  email: z.string().email().max(320).toLowerCase(),
  password: z.string().min(12).max(256),
  role: z.enum(["admin", "user"]),
});
```

### Validation Checklist

- ✅ Auth endpoints validate email/password format
- ✅ Job submission validates URLs (format, safety, internal IP rejection)
- ✅ Batch submission validates up to 100 URLs max
- ✅ Profile edits validate field lengths
- ✅ All numeric inputs have min/max bounds
- ✅ All enum fields restrict to valid values

## 4. API Protection

### Rate Limiting

**Implemented per-user limits:**
- Login: 10 job submissions per minute
- Batch: Quota tracked per user

**Recommended (not yet implemented):**
- Per-IP rate limiting (e.g., 100 requests per 15 minutes)
- API key throttling (if adding API mode later)
- Domain-based crawling politeness (5 concurrent requests per domain)

```typescript
// Add to route handlers:
const rateLimit = new Map();
const now = Date.now();
const key = `${userId}:${Math.floor(now / 60000)}`;
if (rateLimit.get(key) >= LIMIT) throw tooManyRequests();
rateLimit.set(key, (rateLimit.get(key) ?? 0) + 1);
```

### CORS (Content Security Policy)

**Next.js defaults:**
- Same-origin only for cookies
- No external API exposure (all internal)
- Set CSP headers in `next.config.js`:

```javascript
headers: async () => [
  {
    source: '/(.*)',
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ],
  },
]
```

### SQL/NoSQL Injection Prevention

✅ **Already protected:**
- Mongoose schema validation (not raw queries)
- Zod input validation (types enforced before DB)
- Parameterized queries (no string interpolation)

**Regex searches use escaping:**
```typescript
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

## 5. Environment Variables & Secrets

### File Structure
```
.env.example        # Template (committed)
.env.local          # Local secrets (gitignored)
.env.production     # Vercel production (set in dashboard)
```

### Never commit to git:
- ❌ API keys
- ❌ Database credentials
- ❌ Session secret
- ❌ Private keys

### Secure handling:
- ✅ Use `.env.local` for local development
- ✅ Set in Vercel dashboard for production
- ✅ Rotate secrets regularly
- ✅ Use separate MongoDB user for each environment

## 6. MongoDB Security

### Connection Security
```typescript
// Validate connection string format
const uri = process.env.MONGODB_URI;
if (!uri || !uri.startsWith('mongodb')) {
  throw new Error('Invalid MONGODB_URI');
}

// Use connection string with credentials
mongodb+srv://username:password@cluster.mongodb.net/dbname
```

### Schema Validation
✅ All schemas have:
- Type definitions
- Max length constraints
- Required vs. optional fields
- Indexed fields for query performance

### Injection Prevention
- ✅ No string concatenation in queries
- ✅ No `eval()` or `$function` operator
- ✅ Mongoose auto-escapes all queries
- ✅ Input validation before DB operation

### Access Control
- ✅ Database user has minimal required permissions
- ✅ Consider using MongoDB roles:
  ```
  db.createRole({
    role: "resumeTailorUser",
    privileges: [
      { resource: {db: "resume_tailor"}, actions: ["find", "insert", "update", "delete"]}
    ]
  })
  ```

## 7. Claude API Protection

### API Key Security
```typescript
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey || !apiKey.startsWith('sk-ant-')) {
  throw new Error('Invalid ANTHROPIC_API_KEY');
}
```

### Rate Limiting
```typescript
// Claude API has built-in rate limits:
// - Standard: 50 requests per minute
// - High-volume: Contact sales

// Implement backoff:
const MAX_RETRIES = 3;
let delay = 1000;
for (let i = 0; i < MAX_RETRIES; i++) {
  try {
    return await client.messages.create(...);
  } catch (e) {
    if (e.status === 429) {
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    } else {
      throw e;
    }
  }
}
```

### Cost Control
```typescript
// Track token usage per user
const usage = {
  inputTokens: response.usage.input_tokens,
  outputTokens: response.usage.output_tokens,
  cacheReadTokens: response.usage.cache_read_input_tokens,
  cacheWriteTokens: response.usage.cache_creation_input_tokens,
};

// Optional: Set monthly limits per user
if (user.usage.thisMonth > MONTHLY_LIMIT) {
  throw new Error("Monthly token limit exceeded");
}
```

## 8. Error Handling

### ✅ Implemented

**Generic error messages to users:**
```typescript
// ❌ Bad - leaks information
throw new Error("User with email john@example.com not found");

// ✅ Good - generic and safe
throw new Error("Incorrect email or password");
```

**Structured error responses:**
```typescript
export const ApiError = (statusCode: number, code: string, message: string) => {
  return NextResponse.json(
    { error: message, code },
    { status: statusCode }
  );
};
```

**Never expose:**
- ❌ Stack traces to users
- ❌ Database error details
- ❌ Internal file paths
- ❌ API key formats
- ❌ Exact validation rules

**Always log for debugging:**
```typescript
console.error(`[${new Date().toISOString()}] Error: ${error.message}`, {
  userId,
  action,
  stack: error.stack,
});
```

## 9. Testing

### Unit Tests (Example)

**`lib/auth/password.test.ts`:**
```typescript
import { hashPassword, verifyPassword } from './password';

describe('Password hashing', () => {
  test('should hash passwords securely', async () => {
    const hash = await hashPassword('TestPassword123456');
    expect(hash).not.toBe('TestPassword123456');
  });

  test('should verify correct password', async () => {
    const password = 'TestPassword123456';
    const hash = await hashPassword(password);
    const valid = await verifyPassword(hash, password);
    expect(valid).toBe(true);
  });

  test('should reject wrong password', async () => {
    const hash = await hashPassword('TestPassword123456');
    const valid = await verifyPassword(hash, 'WrongPassword123456');
    expect(valid).toBe(false);
  });

  test('should reject short passwords', () => {
    expect(() => hashPassword('short')).rejects.toThrow();
  });
});
```

**`lib/jobs/extractor.test.ts`:**
```typescript
import { validateUrl, normalizeUrl, extractDomain } from './extractor';

describe('URL validation', () => {
  test('should reject localhost', () => {
    const result = validateUrl('http://localhost:3000/job');
    expect(result.valid).toBe(false);
  });

  test('should reject internal IPs', () => {
    const result = validateUrl('http://192.168.1.1/job');
    expect(result.valid).toBe(false);
  });

  test('should accept valid URLs', () => {
    const result = validateUrl('https://example.com/job/123');
    expect(result.valid).toBe(true);
  });

  test('should normalize URLs', () => {
    const url = 'https://example.com/job?utm_source=test#section';
    const normalized = normalizeUrl(url);
    expect(normalized).not.toContain('utm_source');
  });
});
```

### Integration Tests (Example)

**`__tests__/auth.integration.test.ts`:**
```typescript
describe('Auth Flow', () => {
  test('should create account and login', async () => {
    // Signup
    const signupRes = await fetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPassword123456',
        name: 'Test User',
      }),
    });
    expect(signupRes.status).toBe(201);

    // Login
    const loginRes = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPassword123456',
      }),
    });
    expect(loginRes.status).toBe(200);
  });

  test('should reject wrong password after 5 attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await fetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'WrongPassword123456',
        }),
      });
    }

    // 6th attempt should be locked
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPassword123456',
      }),
    });
    expect(res.status).toBe(429);
  });
});
```

### Running Tests

```bash
# Install testing dependencies
npm install --save-dev vitest @testing-library/react jsdom

# Add to package.json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 10. Build Verification

### Pre-deployment Checklist

**`scripts/pre-deploy.sh`:**
```bash
#!/bin/bash
set -e

echo "🔍 Pre-deployment verification..."

# Type check
echo "  ✓ Running TypeScript check..."
npm run typecheck

# Build
echo "  ✓ Building Next.js..."
npm run build

# Environment variables
echo "  ✓ Checking required env vars..."
required_vars=(
  "ANTHROPIC_API_KEY"
  "MONGODB_URI"
  "SESSION_SECRET"
  "ADMIN_EMAIL"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "  ✗ Missing: $var"
    exit 1
  fi
done

echo "✅ All checks passed!"
```

**GitHub Actions Workflow** (`.github/workflows/deploy.yml`):
```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
      - run: npm test -- --run

      - name: Deploy to Vercel
        run: |
          npm install -g vercel
          vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

## 11. Vercel Deployment

### Setup Steps

1. **Connect repository:**
   ```bash
   vercel login
   vercel link
   ```

2. **Set environment variables in Vercel Dashboard:**
   - Go to Settings → Environment Variables
   - Add:
     ```
     ANTHROPIC_API_KEY=sk-ant-...
     MONGODB_URI=mongodb+srv://user:pass@...
     SESSION_SECRET=<32-byte-hex>
     ADMIN_EMAIL=your-email@example.com
     ANTHROPIC_MODEL=claude-sonnet-5
     MONGODB_DB=resume_tailor
     NODE_ENV=production
     ```

3. **Configure Next.js for production:**
   ```javascript
   // next.config.js
   module.exports = {
     reactStrictMode: true,
     swcMinify: true,
     httpAgentOptions: {
       keepAlive: true,
     },
     headers: async () => [
       {
         source: '/(.*)',
         headers: [
           { key: 'X-Content-Type-Options', value: 'nosniff' },
           { key: 'X-Frame-Options', value: 'DENY' },
           { key: 'X-XSS-Protection', value: '1; mode=block' },
         ],
       },
     ],
   };
   ```

4. **Deploy:**
   ```bash
   vercel --prod
   ```

## 12. Production Environment Configuration

### Vercel Project Settings

- **Node.js Version:** 18.x or 20.x
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Install Command:** `npm ci`
- **Development Command:** `npm run dev`

### Performance Optimizations

```javascript
// Enable caching
const oneYear = 365 * 24 * 60 * 60;
export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.match(/^\/api\//)) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    return response;
  }
}
```

### Monitoring & Logging

- **Vercel Analytics:** Enable in dashboard
- **Error tracking:** Integrate Sentry
  ```typescript
  import * as Sentry from "@sentry/nextjs";
  
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
  });
  ```

## Security Checklist

- [ ] SESSION_SECRET is 32+ bytes (256-bit) entropy
- [ ] ANTHROPIC_API_KEY is valid and has no exposed logs
- [ ] MONGODB_URI uses username/password (not anonymous)
- [ ] Database user has minimal permissions
- [ ] ADMIN_EMAIL is configured and verified
- [ ] All environment variables set in Vercel (no hardcoded values)
- [ ] HTTPS enforced for all traffic
- [ ] Rate limiting enabled for login endpoint
- [ ] Error messages are generic (no system details leaked)
- [ ] Input validation on every API endpoint
- [ ] Authorization checks on every protected route
- [ ] Tests running on every push
- [ ] Build verification in CI/CD

## Incident Response

### If API key is compromised:
1. Immediately regenerate in Anthropic console
2. Update in Vercel environment variables
3. Review audit logs for suspicious activity
4. Rotate DATABASE_URL if also compromised

### If database is compromised:
1. Create new MongoDB Atlas user
2. Update MONGODB_URI in Vercel
3. Audit user accounts and sessions
4. Consider password reset enforcement

### If SESSION_SECRET is exposed:
1. Generate new SESSION_SECRET
2. Update in Vercel environment variables
3. All existing sessions automatically invalidated

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Argon2 Parameters](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [MongoDB Security](https://docs.mongodb.com/manual/security/)
- [Next.js Security](https://nextjs.org/docs/going-to-production#security)
