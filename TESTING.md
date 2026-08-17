# Testing Strategy

## Overview

This document outlines the testing approach for Resume Tailor, covering unit tests, integration tests, E2E tests, and security testing.

## Test Setup

### Install Testing Dependencies

```bash
npm install --save-dev \
  vitest \
  @vitest/ui \
  @testing-library/react \
  @testing-library/jest-dom \
  jsdom \
  @vitejs/plugin-react
```

### Configuration Files

- `vitest.config.ts` - Vitest configuration with jsdom environment
- `vitest.setup.ts` - Global test setup and mocks
- `__tests__/` - Test directory structure

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- __tests__/lib/auth/password.test.ts

# Run tests matching pattern
npm test -- --grep "password"

# Run UI for test exploration
npm test -- --ui
```

## Unit Tests

Unit tests cover individual functions and modules in isolation.

### Password Hashing (`__tests__/lib/auth/password.test.ts`)

Tests password hashing and verification with Argon2id:

```typescript
// Verify hash is different from plaintext
// Verify correct password matches
// Verify wrong password is rejected
// Verify minimum length requirement (12 chars)
// Verify hash is non-deterministic (salted)
// Verify unicode support
```

**Coverage:**
- ✅ hashPassword() creates valid hash
- ✅ verifyPassword() validates correct password
- ✅ verifyPassword() rejects wrong password
- ✅ Short passwords throw error
- ✅ Hash randomization (salt)
- ✅ Unicode password handling

### URL Validation (`__tests__/lib/jobs/extractor.test.ts`)

Tests URL parsing, validation, and normalization:

```typescript
// Reject localhost/127.0.0.1
// Reject internal IP ranges (10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12)
// Accept valid public URLs
// Require HTTPS
// Normalize URLs (remove tracking params, hash)
// Extract domain correctly
// Handle query parameters
// Reject malformed URLs
```

**Coverage:**
- ✅ Localhost rejection (all variants)
- ✅ Internal IP rejection
- ✅ Public URL acceptance
- ✅ HTTPS enforcement
- ✅ Query parameter removal (utm_*, etc.)
- ✅ Fragment removal (#section)
- ✅ Domain extraction
- ✅ Malformed URL rejection

## Integration Tests

Integration tests verify multiple components working together.

### Authentication Flow

Test complete signup → login → session:

```typescript
// User signup with valid email and password
// Login with correct credentials
// Login rejection with wrong password
// Account lockout after 5 failures
// Session cookie creation
// Session validation on protected route
// Logout clears session
```

**Setup:**
```bash
# Use test MongoDB instance (local or Atlas staging)
# Set environment variables:
export MONGODB_URI=mongodb://localhost:27017/resume_tailor_test
export SESSION_SECRET=test-secret-32-bytes-long-secure
export ANTHROPIC_API_KEY=test-key-placeholder
```

### API Route Tests

Test API endpoints with realistic request/response:

```typescript
// Validate input with Zod schema
// Check authorization (401/403)
// Check ownership (404 for others' resources)
// Verify error responses (generic messages)
```

## End-to-End (E2E) Tests

E2E tests verify complete user workflows using the browser.

### Recommended: Playwright

```bash
npm install --save-dev @playwright/test
```

**Example: Resume tailoring flow**

```typescript
import { test, expect } from '@playwright/test';

test('complete resume tailoring flow', async ({ page }) => {
  // 1. Navigate to home
  await page.goto('/');
  
  // 2. Login
  await page.fill('input[type="email"]', 'user@example.com');
  await page.fill('input[type="password"]', 'Password123456!');
  await page.click('button[type="submit"]');
  
  // 3. Wait for profile page
  await expect(page).toHaveURL('/profile');
  
  // 4. Submit job URL
  await page.goto('/jobs');
  await page.fill('input[placeholder="Paste job URL"]', 'https://example.com/job/123');
  await page.click('button:has-text("Submit")');
  
  // 5. Wait for tailoring
  await page.waitForSelector('[data-status="completed"]', { timeout: 30000 });
  
  // 6. Export resume
  await page.click('button[title="Export PDF"]');
  
  // 7. Verify download
  const downloadPromise = page.waitForEvent('download');
  await page.click('a:has-text("Download")');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('.pdf');
});
```

## Performance Testing

Test API response times and database query performance:

```bash
# Load test with autocannon
npm install --save-dev autocannon

# Run load test (before deployment)
autocannon -c 10 -d 30 http://localhost:3000/api/health
```

## Security Testing

### Manual Security Checks

```bash
# 1. Scan for exposed secrets
npm run pre-deploy

# 2. Check dependencies for vulnerabilities
npm audit

# 3. Run OWASP ZAP or similar tool against staging
```

### Automated Security Tests

**Input Validation Test:**
```typescript
describe('API Input Validation', () => {
  it('should reject oversized inputs', async () => {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        summary: 'x'.repeat(50000), // 50KB, exceeds limit
      }),
    });
    expect(res.status).toBe(400);
  });

  it('should reject invalid email format', async () => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'not-an-email',
        password: 'ValidPassword123456!',
      }),
    });
    expect(res.status).toBe(400);
  });
});
```

**Authorization Test:**
```typescript
describe('Authorization', () => {
  it('should reject unauthenticated access', async () => {
    const res = await fetch('/api/profile'); // No auth header/cookie
    expect(res.status).toBe(401);
  });

  it('should reject cross-user access', async () => {
    const res = await fetch(`/api/resumes/${otherUserResume}`, {
      headers: { Cookie: currentUserCookie },
    });
    expect(res.status).toBe(404); // Return 404, not 403 to prevent enumeration
  });
});
```

## Test Data Management

### Fixtures

Create reusable test data:

```typescript
// __tests__/fixtures/user.ts
export const testUser = {
  email: 'test@example.com',
  password: 'TestPassword123456!',
  name: 'Test User',
};

export const adminUser = {
  email: 'admin@example.com',
  password: 'AdminPassword123456!',
  name: 'Admin User',
  role: 'admin',
};
```

### Database Cleanup

```typescript
beforeEach(async () => {
  // Clear test database before each test
  await User.deleteMany({ email: { $regex: '^test' } });
});

afterEach(async () => {
  // Cleanup after test
  await connectToDatabase();
  // Don't drop entire DB, just test records
});
```

## Continuous Integration

GitHub Actions runs tests on every push:

```yaml
# .github/workflows/ci.yml
- npm run typecheck
- npm run build
- npm test -- --run
```

### Before Deployment

```bash
# Local pre-deployment check
npm run pre-deploy

# Then commit and push (CI runs automatically)
git push origin main
```

## Coverage Goals

Target coverage by component:

| Component | Coverage | Notes |
|-----------|----------|-------|
| Auth (password, session) | 90%+ | Critical security code |
| API routes | 80%+ | Entry points must validate |
| Job extraction | 85%+ | Complex parsing logic |
| Resume tailoring | 70%+ | Depends on Claude API |
| UI components | 50%+ | Visual testing preferred |

Check coverage:

```bash
npm test -- --coverage

# Open HTML report
open coverage/index.html
```

## Troubleshooting

### Tests timeout

Increase timeout for slow operations:

```typescript
test('slow operation', async () => {
  // ...
}, 10000); // 10 second timeout
```

### MongoDB connection fails in tests

Use in-memory MongoDB:

```bash
npm install --save-dev mongodb-memory-server
```

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
});

afterAll(async () => {
  await mongoServer.stop();
});
```

### Claude API calls fail in tests

Mock the Anthropic client:

```typescript
import { vi } from 'vitest';

vi.mock('@/lib/tailor/engine', () => ({
  tailorResume: vi.fn().mockResolvedValue({
    generated: {
      resume: { /* mock resume */ },
      coverLetter: 'Mock cover letter',
    },
    analysis: { matchScore: 85 },
  }),
}));
```

## Test Writing Guidelines

### Do's

✅ Test one concept per test
✅ Use descriptive test names
✅ Test both happy path and error cases
✅ Mock external dependencies (Claude API, MongoDB at unit level)
✅ Use fixtures for reusable data
✅ Clean up resources (files, DB) after tests

### Don'ts

❌ Don't test implementation details
❌ Don't create dependencies between tests
❌ Don't use real API calls in unit tests
❌ Don't hardcode test data in multiple places
❌ Don't ignore timing issues (use proper waits)
❌ Don't skip tests without a comment

## Future Testing Improvements

- [ ] Add visual regression testing (Percy, Chromatic)
- [ ] Implement contract testing for API
- [ ] Add mutation testing (stryker) to verify test quality
- [ ] Setup integration tests with real MongoDB Atlas staging
- [ ] Add E2E tests with Playwright CI
- [ ] Performance baseline testing on every deploy

## References

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Best Practices](https://testing-library.com/docs/)
- [Playwright Testing](https://playwright.dev/docs/intro)
- [OWASP Security Testing](https://owasp.org/www-project-web-security-testing-guide/)
