# Vercel Deployment Guide - Resume Tailor

## Pre-Deployment Checklist

### ✅ TypeScript & Code Quality
- [x] All TypeScript errors fixed (`npm run typecheck` passes)
- [x] Strict mode enabled in `tsconfig.json`
- [x] Proper type annotations for all API routes
- [x] No `any` types in critical paths

### ✅ Next.js Configuration
- [x] `next.config.js` optimized for Vercel
- [x] `serverComponentsExternalPackages` configured for MongoDB, Anthropic, PDF rendering
- [x] Security headers configured
- [x] `swcMinify` enabled for smaller bundles

### ✅ Environment Variables
- [x] `.env.example` includes all required variables
- [x] `.env.local` is in `.gitignore`
- [x] Proper environment variable documentation

## Step-by-Step Deployment

### 1. **Prepare Environment Variables**

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:
```env
ANTHROPIC_API_KEY=your_api_key
MONGODB_URI=your_mongodb_connection_string
SESSION_SECRET=generate_with_openssl_rand_-hex_32
ADMIN_EMAIL=your_email@example.com
ANTHROPIC_MODEL=claude-sonnet-5
MONGODB_DB=resume_tailor
NODE_ENV=production
```

### 2. **Generate Session Secret (Required)**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output to `SESSION_SECRET` in your environment variables.

### 3. **Set Up MongoDB**

Options:
- **MongoDB Atlas** (Recommended for Vercel)
  - Go to https://www.mongodb.com/cloud/atlas
  - Create cluster
  - Get connection string
  - Add to `MONGODB_URI`

- **Self-hosted MongoDB**
  - Ensure database is publicly accessible
  - Use full connection string with credentials

### 4. **Create Vercel Project**

**Option A: GitHub Integration (Recommended)**
```bash
# Push code to GitHub
git remote add origin https://github.com/your-username/resume-tailor.git
git push -u origin main

# Then:
# 1. Go to https://vercel.com
# 2. Click "New Project"
# 3. Import your GitHub repo
# 4. Click "Deploy"
```

**Option B: CLI Deploy**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts
```

### 5. **Configure Vercel Environment Variables**

In Vercel dashboard:
1. Go to Settings → Environment Variables
2. Add each variable:
   - `ANTHROPIC_API_KEY`
   - `MONGODB_URI`
   - `SESSION_SECRET`
   - `ADMIN_EMAIL`
   - `ANTHROPIC_MODEL`
   - `MONGODB_DB`
   - `NODE_ENV=production`

### 6. **Deploy**

```bash
# Via CLI (after configuring env vars)
vercel --prod

# Or redeploy via GitHub push
git push origin main
```

## Vercel-Specific Configuration

### ✅ Already Configured

**`next.config.js`**:
```javascript
// External packages that cannot be bundled
serverComponentsExternalPackages: [
  '@react-pdf/renderer',  // Native dependencies
  '@node-rs/argon2',      // Node binary addon
  'mongoose',             // MongoDB driver
],
```

**Security Headers**:
```javascript
// Anti-clickjacking, XSS protection, etc.
headers: async () => [
  {
    source: '/:path((?!_next/static|favicon.ico).*)',
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      // ... more headers
    ],
  },
]
```

### ⚠️ Known Limitations on Vercel

**Serverless Functions**:
- Max execution time: 60 seconds (Pro) or 10 seconds (Hobby)
- Job extraction with LLM may take 1-2 seconds per URL
- Batch processing is handled asynchronously in background

**Recommended for Heavy Processing**:
- Keep LLM calls under 5 seconds
- Implement request timeouts (already done: 15 seconds)
- Use background jobs for batch operations (already implemented)

## Testing Before Deployment

### Local Production Build

```bash
# Build
npm run build

# Start production server
npm run start

# Test critical endpoints
curl http://localhost:3000/api/health

# Test auth
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

### Test Checklist

- [ ] Homepage loads
- [ ] Can sign up/login
- [ ] Can upload resume
- [ ] Can submit job URL
- [ ] Job extraction works
- [ ] Resume tailoring works
- [ ] PDF/DOCX download works
- [ ] Database operations work

## After Deployment

### Verify Deployment

```bash
# Check deployment status
vercel ls

# View logs
vercel logs your-project-name

# Check health
curl https://your-domain.vercel.app/api/health
```

### Promote Admin User

After first deployment:

1. Sign up with `ADMIN_EMAIL` email
2. User is automatically promoted to admin
3. Other signups will be pending until approved

### Monitor Logs

```bash
# Stream logs from Vercel
vercel logs your-project-name --follow

# Or use Vercel Dashboard → Deployments → Logs
```

## Troubleshooting

### Issue: "MongoDB connection failed"

**Solution**:
1. Check `MONGODB_URI` is correct
2. Verify MongoDB allows connections from Vercel IPs
3. MongoDB Atlas: Settings → Network Access → Allow Anywhere (0.0.0.0/0)

```bash
# Test connection locally
MONGODB_URI=your_uri node -e "
  require('mongodb').MongoClient.connect(process.env.MONGODB_URI)
    .then(() => console.log('✓ Connected'))
    .catch(e => console.error('✗', e.message))
"
```

### Issue: "Anthropic API key not found"

**Solution**:
1. Verify `ANTHROPIC_API_KEY` is set in Vercel env vars
2. Redeploy after adding it: `vercel --prod`
3. Check it's not a copy-paste error (extra spaces, etc)

### Issue: "PDF export fails"

**Solution**:
- PDF rendering requires `@react-pdf/renderer`
- Already in `serverComponentsExternalPackages`
- If still failing: Check error logs with `vercel logs`

### Issue: "Function timeout (60s exceeded)"

**Solution**:
- Batch operations run in background (no timeout)
- Single operations have 15-second timeout
- If LLM calls timeout:
  1. Check Anthropic API status
  2. Reduce max_tokens in `app/api/batch/route.ts`
  3. Use fallback manual entry

### Issue: "Build fails with TypeScript errors"

**Solution**:
```bash
# Run typecheck locally first
npm run typecheck

# Fix all errors before pushing
# Then deploy
git push origin main
```

## Performance Optimization

### ✅ Already Implemented

1. **SWC Minification** - Faster builds
2. **Incremental Static Regeneration** - Caching
3. **External Package Configuration** - Proper bundling
4. **Timeout Protection** - 15-second limits on API calls
5. **Rate Limiting** - 10 jobs per minute per user

### Optional Improvements

**Add Caching Headers** (in `next.config.js`):
```javascript
async headers() {
  return [
    {
      source: '/api/export/:path*',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store' },
      ],
    },
  ]
}
```

**Enable Analytics** (in Vercel Dashboard):
1. Go to Settings → Analytics
2. Enable Web Analytics
3. Monitor performance

## Database Backups

### MongoDB Atlas Backups
1. Go to MongoDB Atlas → Backups
2. Enable automatic daily backups
3. Test restore process monthly

### Manual Backup
```bash
# Export data
mongodump --uri="your_mongodb_uri" --out=./backup

# Import data
mongorestore --uri="your_mongodb_uri" ./backup
```

## Scaling & Limits

### Vercel Pro Limits (Recommended)

- **Build time**: Up to 45 minutes
- **Function timeout**: 60 seconds
- **Concurrent functions**: 100+
- **Bandwidth**: 1TB/month included

### Upgrade When

- More than 100 concurrent users
- Batch processing > 50 jobs/day
- Need higher timeout limits

## Security Checklist

- [ ] All env vars are secret (not in code)
- [ ] `SESSION_SECRET` is random & unique
- [ ] Database has password protection
- [ ] HTTPS enabled (automatic on Vercel)
- [ ] Security headers configured
- [ ] Admin email is set
- [ ] Rate limiting enabled

## Rollback Instructions

```bash
# List deployments
vercel ls

# Rollback to previous version
vercel promote <deployment-id>

# Or through dashboard: Deployments → Click previous → Promote
```

## Monitoring & Alerts

### Set Up Alerts (Vercel Pro)

1. Go to Settings → Alerts
2. Enable failure notifications
3. Add email for build/deployment failures

### Monitor Key Metrics

- Build time
- Function execution time
- Error rate
- Database response time

Check via: Dashboard → Analytics → Performance

## Support & Resources

- **Vercel Docs**: https://vercel.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **MongoDB Docs**: https://docs.mongodb.com
- **Anthropic Docs**: https://docs.anthropic.com

---

**Last Updated**: August 2026  
**Status**: Production Ready for Vercel Deployment
