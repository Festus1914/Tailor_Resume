# Resume Tailor

AI-powered resume tailoring application built with Next.js, TypeScript, and Claude API. Tailors your master resume to specific job postings in seconds.

## Features

- 🎯 **Smart Resume Tailoring** - Extract job requirements and automatically tailor your resume using Claude AI
- 📋 **Master Resume Management** - Store and manage your professional profile once, tailor to any position
- 🔐 **Secure Authentication** - Argon2id password hashing, server-side sessions, account lockout protection
- 👥 **Role-Based Admin Panel** - Manage users, approve accounts, view audit logs
- 📦 **Batch Processing** - Submit up to 100 job URLs for efficient bulk tailoring
- 📊 **Match Analysis** - See matching keywords, missing skills, and match percentage for each role
- 📥 **Multiple Export Formats** - Download tailored resumes as PDF, DOCX, or plain text
- 🗄️ **Resume History** - Track and manage all tailored resumes with search and filtering
- ⚡ **Real-time Progress** - Live status updates for batch processing with immediate feedback

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Validation**: Zod

### Backend
- **Runtime**: Node.js (Next.js API Routes)
- **Database**: MongoDB with Mongoose ODM
- **Auth**: Custom session-based (opaque tokens, server-side validation)
- **Password**: Argon2id hashing (OWASP parameters)
- **AI**: Claude Sonnet 5 API

### Export
- **PDF**: @react-pdf/renderer
- **DOCX**: docx library
- **Text**: Custom formatter

## Quick Start

### Prerequisites
- Node.js 18+ or 20+
- MongoDB (local or Atlas)
- Anthropic API key (Claude)

### Local Setup

```bash
# Clone repository
git clone <repo-url>
cd resume-tailor

# Install dependencies
npm install

# Create .env.local with secrets
cp .env.example .env.local
# Edit .env.local and add:
# - ANTHROPIC_API_KEY=sk-ant-...
# - MONGODB_URI=mongodb+srv://...
# - SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
# - ADMIN_EMAIL=your-email@example.com

# Verify setup
npm run typecheck
npm run build

# Run development server
npm run dev
```

Open http://localhost:3000 in browser.

## Project Structure

```
resume-tailor/
├── app/
│   ├── (admin)/              # Admin panel routes (protected)
│   ├── (app)/                # User app routes (authenticated)
│   ├── (auth)/               # Auth routes (login, signup)
│   ├── api/
│   │   ├── admin/            # Admin API endpoints
│   │   ├── auth/             # Authentication endpoints
│   │   ├── batch/            # Batch processing API
│   │   ├── health/           # Health check endpoint
│   │   ├── jobs/             # Job URL management API
│   │   ├── profile/          # User profile API
│   │   ├── resumes/          # Resume management API
│   │   ├── tailor/           # Resume tailoring API
│   │   └── export/           # Export to PDF/DOCX
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── admin/                # Admin UI components
│   ├── auth/                 # Auth UI components
│   ├── profile/              # Profile editor components
│   └── ...
├── lib/
│   ├── api.ts
│   ├── mongodb.ts
│   ├── types.ts
│   ├── auth/                 # Auth utilities
│   ├── jobs/                 # Job extraction
│   ├── tailor/               # Claude integration
│   ├── models/               # Mongoose schemas
│   └── validation/           # Zod schemas
├── middleware.ts
├── __tests__/                # Unit & integration tests
├── scripts/                  # Utility scripts
├── .github/workflows/        # CI/CD configuration
├── SECURITY.md               # Security guide
├── DEPLOYMENT.md             # Deployment guide
├── TESTING.md                # Testing guide
└── PHASE_10_SUMMARY.md       # Phase 10 completion summary
```

## Key Concepts

### Authentication Flow
1. User signs up with email/password
2. Password hashed with Argon2id
3. Server creates opaque session token
4. Token stored in HTTP-only cookie
5. Middleware validates cookie on each request
6. Guards re-verify session in database
7. Allows immediate account disabling

### Resume Tailoring Process
1. User creates master resume in profile
2. Submits job URL (single or batch)
3. Job posting extracted with JSON-LD parsing
4. Claude API generates tailored resume + cover letter
5. Analysis includes match score and keyword recommendations
6. User can edit and export in multiple formats
7. Original AI version preserved in database

### Batch Processing
- Up to 100 URLs per batch
- Lease-pattern worker queue (JobTask model)
- Real-time progress tracking
- Automatic retry for failed jobs (max 3 attempts)
- Cooperative cancellation (flag-based)

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user

### Profile & Resume
- `GET/PATCH /api/profile` - User profile
- `GET /api/resumes` - List tailored resumes
- `GET /api/resumes/:id` - Resume details
- `PATCH /api/resumes/:id` - Edit resume
- `DELETE /api/resumes/:id` - Delete resume
- `GET /api/resumes/:id/export` - Export resume

### Jobs & Tailoring
- `GET/POST /api/jobs` - Job management
- `GET/POST /api/tailor/single` - Single job tailoring
- `POST /api/batch` - Create batch job
- `GET /api/batch/:id` - Batch status

### Admin
- `GET /api/admin/users` - List users
- `PATCH /api/admin/users/:id` - Manage user
- `GET /api/admin/audit` - Audit logs

### Health
- `GET /api/health` - Health check

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- __tests__/lib/auth/password.test.ts
```

See `TESTING.md` for comprehensive testing guide.

## Security

### Built-in Protections
- ✅ Argon2id password hashing (OWASP parameters: 19 MiB, 2 iterations)
- ✅ Server-side session validation (opaque tokens)
- ✅ Account lockout (5 failures → 15min → 1hr → 24hr)
- ✅ Input validation on all endpoints (Zod schemas)
- ✅ Rate limiting (10 submissions/minute per user)
- ✅ NoSQL injection prevention (Mongoose + input validation)
- ✅ Authorization checks (middleware + guards)
- ✅ Error message sanitization (generic messages to users)
- ✅ Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- ✅ URL validation (localhost/internal IP rejection)

See `SECURITY.md` for comprehensive security documentation.

## Deployment

### To Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login and link project
vercel login
vercel link

# Set environment variables in Vercel Dashboard
# Then deploy
vercel --prod
```

### Environment Variables (Production)
```
ANTHROPIC_API_KEY=sk-ant-...
MONGODB_URI=mongodb+srv://user:pass@...
SESSION_SECRET=<32-byte-hex-random>
ADMIN_EMAIL=admin@example.com
NODE_ENV=production
```

See `DEPLOYMENT.md` for detailed deployment guide with troubleshooting.

## Pre-Deployment Checklist

```bash
# Run automated checks
npm run pre-deploy
```

Verifies:
- ✅ TypeScript compilation
- ✅ Next.js build success
- ✅ Required environment variables
- ✅ .env.local in .gitignore
- ✅ SESSION_SECRET minimum length
- ✅ No hardcoded secrets in code

## Health Check

```bash
curl https://your-domain.com/api/health
```

Response (200 OK):
```json
{
  "ok": true,
  "database": "connected"
}
```

## Performance Optimizations

- **Caching**: Claude prompt caching for repeated job descriptions
- **Database**: Indexed queries for fast searches
- **Bundling**: SWC minification, tree-shaking
- **API**: Keep-alive HTTP connections for MongoDB

## Monitoring & Observability

### Built-in
- ✅ Audit logging for admin actions
- ✅ Failed login tracking
- ✅ Token usage tracking per user
- ✅ Job processing status tracking

### Recommended for Production
- Sentry for error tracking
- Vercel Analytics for performance monitoring
- DataDog/New Relic for APM

## Documentation

- **SECURITY.md** — Complete security reference (620+ lines)
- **DEPLOYMENT.md** — Deployment walkthrough (360+ lines)
- **TESTING.md** — Testing strategies and examples (400+ lines)
- **PHASE_10_SUMMARY.md** — Phase 10 implementation summary

## Development Workflow

```bash
# Start dev server
npm run dev

# Check types
npm run typecheck

# Run tests
npm test

# Build for production
npm run build

# Pre-deployment verification
npm run pre-deploy
```

## Contributing

1. Create feature branch
2. Make changes
3. Run tests: `npm test`
4. Verify types: `npm run typecheck`
5. Submit PR

---

**Built with ❤️ using Next.js, TypeScript, and Claude API**

All 10 phases complete. Production-ready. August 2026.
- `app/api/export/pdf/route.tsx` — renders the (possibly hand-edited) text
  into a formatted PDF using `@react-pdf/renderer`.
- `app/api/export/docx/route.ts` — same, but produces a `.docx` using the
  `docx` package.

## Customizing

- **Model**: change `MODEL` in `lib/anthropic.ts`.
- **Tailoring behavior**: edit `SYSTEM_PROMPT` in `app/api/tailor/route.ts`
  (e.g. to bias toward a specific industry, tone, or resume format).
- **Styling**: colors/fonts live in `tailwind.config.ts`.

## Deploying

Works out of the box on Vercel — just set `ANTHROPIC_API_KEY` as an
environment variable in your project settings. No database or other
services required.

## Notes on accuracy

The model is instructed not to invent employers, titles, dates, or
achievements — only to re-emphasize and re-word your real experience. Always
proofread the output before sending it anywhere.
