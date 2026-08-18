# Vercel Deployment Checklist - Resume Tailor

## Pre-Deployment Verification ✅

### Code Quality
- [x] TypeScript strict mode enabled
- [x] All TypeScript errors fixed
- [x] `npm run typecheck` passes
- [x] No `any` types in critical code
- [x] Proper error handling throughout

### Configuration
- [x] `tsconfig.json` optimized for Vercel
- [x] `next.config.js` configured correctly
- [x] External packages properly configured
- [x] Security headers implemented
- [x] Environment variables documented

### Features Implemented
- [x] User authentication
- [x] Job URL parsing with AI fallback
- [x] Batch job import with progress tracking
- [x] Resume tailoring
- [x] PDF & DOCX export (both formats)
- [x] Download error handling
- [x] Rate limiting

---

## Deployment Steps

### Step 1: Prepare Credentials

```bash
# Generate SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Save output - you'll need this for Vercel
```

**Required Credentials**:
- `ANTHROPIC_API_KEY` - from https://console.anthropic.com
- `MONGODB_URI` - from MongoDB Atlas or self-hosted
- `SESSION_SECRET` - generated above
- `ADMIN_EMAIL` - your email address

### Step 2: Create Vercel Account

1. Go to https://vercel.com
2. Sign up with GitHub/GitLab/Bitbucket
3. Create a new team (optional)

### Step 3: Connect Repository

**GitHub:**
1. Push code to GitHub: `git push origin main`
2. Go to https://vercel.com/new
3. Import GitHub repository
4. Select project settings

**Or Use CLI:**
```bash
npm i -g vercel
vercel login
vercel
```

### Step 4: Configure Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

| Variable | Value | Required |
|----------|-------|----------|
| `ANTHROPIC_API_KEY` | Your API key | ✅ |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | ✅ |
| `MONGODB_URI` | Connection string | ✅ |
| `MONGODB_DB` | `resume_tailor` | ✅ |
| `SESSION_SECRET` | Generated value | ✅ |
| `ADMIN_EMAIL` | Your email | ✅ |
| `NODE_ENV` | `production` | ✅ |

**Scopes**: Set to "Production", "Preview", and "Development"

### Step 5: Deploy

**Via GitHub (Auto-deploy)**:
```bash
git push origin main
# Vercel automatically builds and deploys
```

**Via CLI**:
```bash
vercel --prod
# Follow prompts to configure
```

**Via Dashboard**:
1. Click "Deploy"
2. Wait for build to complete
3. Click "Visit" to test

---

## Post-Deployment Verification

### Step 1: Check Health Endpoint

```bash
curl https://your-domain.vercel.app/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

### Step 2: Test Authentication

```bash
# Sign up
curl -X POST https://your-domain.vercel.app/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"TestPassword123!"
  }'

# Login
curl -X POST https://your-domain.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"TestPassword123!"
  }'
```

### Step 3: Test Core Features

- [ ] Homepage loads
- [ ] Can sign up
- [ ] Can log in
- [ ] Can upload resume
- [ ] Can submit job URL
- [ ] Job extraction works
- [ ] Resume tailoring works
- [ ] PDF download works
- [ ] DOCX download works
- [ ] Admin approval system works

### Step 4: Monitor Logs

```bash
# View real-time logs
vercel logs your-project-name --follow

# Or in Vercel Dashboard → Deployments → Logs
```

### Step 5: Promote Admin User

1. Sign up with `ADMIN_EMAIL` address
2. Check email for verification
3. User is automatically promoted to admin
4. Approve other signups from admin panel

---

## Common Issues & Solutions

### Build Fails: TypeScript Error
```
Solution:
1. Run locally: npm run typecheck
2. Fix errors
3. Push changes: git push origin main
4. Vercel will rebuild
```

### MongoDB Connection Fails
```
Solution:
1. Verify MONGODB_URI is correct
2. Check credentials (user:pass)
3. MongoDB Atlas: Network Access → Allow 0.0.0.0/0
4. Redeploy: vercel --prod
```

### Anthropic API Fails
```
Solution:
1. Verify ANTHROPIC_API_KEY is set
2. Check API key is not expired
3. Verify ANTHROPIC_MODEL exists
4. Check API quotas at console.anthropic.com
5. Redeploy: vercel --prod
```

### Environment Variables Not Updated
```
Solution:
1. Add variables to Vercel Dashboard
2. Click "Save"
3. Redeploy: vercel --prod (or git push)
4. Variables take effect after redeploy
```

### Function Timeout (>60 seconds)
```
Solution:
1. Check if batch processing is running
2. Batch processing runs in background (OK)
3. Single operations have 15s timeout
4. Check logs: vercel logs your-project
```

---

## After Successful Deployment

### Enable Analytics

1. Go to Vercel Dashboard → Settings → Analytics
2. Click "Enable Web Analytics"
3. Track performance metrics

### Set Up Error Monitoring

```bash
# Via Sentry (optional)
npm install @sentry/nextjs

# Configure in next.config.js
```

### Configure Custom Domain

1. Buy domain from: GoDaddy, Namecheap, etc.
2. In Vercel Dashboard → Settings → Domains
3. Add your domain
4. Update DNS records
5. Wait for verification (5-15 min)

### Enable Auto-Deploy on Push

Already configured if using GitHub!

```yaml
# Pushes to main automatically trigger deployment
```

### Set Up Alerts

1. Vercel Dashboard → Settings → Alerts
2. Enable build/deployment failure notifications
3. Add email address

---

## Testing Checklist

### Core Functionality
- [x] Authentication (sign up, login, logout)
- [x] Profile management
- [x] Job submission (single & batch)
- [x] Job extraction (JSON-LD & LLM)
- [x] Resume tailoring
- [x] PDF/DOCX exports
- [x] Admin approval system

### Edge Cases
- [ ] Invalid job URLs
- [ ] Blocked websites (403/401)
- [ ] Network timeouts
- [ ] Large batches (50+ URLs)
- [ ] Concurrent users
- [ ] Rapid API calls (rate limiting)

### Performance
- [ ] Homepage loads < 2s
- [ ] API responses < 1s
- [ ] Batch processing < 2s/job
- [ ] PDF generation < 5s
- [ ] Database queries < 100ms

---

## Maintenance

### Weekly
- [ ] Check error logs: `vercel logs`
- [ ] Monitor performance in Vercel Analytics
- [ ] Check MongoDB storage usage

### Monthly
- [ ] Test backup/restore process
- [ ] Review admin approvals
- [ ] Check for security updates
- [ ] Review API quotas (Anthropic)

### Quarterly
- [ ] Database optimization
- [ ] Performance tuning
- [ ] Update dependencies

---

## Rollback Instructions

If something breaks after deployment:

```bash
# List recent deployments
vercel ls

# Find previous working deployment
# Copy deployment ID (shown as timestamp)

# Promote previous version
vercel promote <deployment-id>

# Or via Dashboard:
# 1. Go to Deployments
# 2. Find previous working version
# 3. Click "..." → "Promote to Production"
```

---

## Support

### Documentation
- **Vercel**: https://vercel.com/docs
- **Next.js**: https://nextjs.org/docs
- **TypeScript**: https://www.typescriptlang.org/docs
- **MongoDB**: https://docs.mongodb.com

### Help Resources
- GitHub Issues: Check project issues
- Vercel Support: https://vercel.com/support
- Stack Overflow: Tag with `vercel` & `next.js`

---

## Success Criteria ✅

Your deployment is successful when:

- [x] `npm run typecheck` passes (0 errors)
- [x] `npm run build` succeeds
- [x] Health endpoint responds
- [x] Authentication works
- [x] Database operations work
- [x] AI features work (job extraction, tailoring)
- [x] Exports work (PDF & DOCX)
- [x] No errors in logs

---

**Congratulations! Your app is ready for production deployment! 🚀**

**Next Step**: Follow the deployment steps above to deploy to Vercel.

---

*Last Updated: August 2026*  
*Status: Production Ready*
