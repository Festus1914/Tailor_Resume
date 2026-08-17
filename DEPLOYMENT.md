# Deployment Guide

## Quick Start

### 1. Prepare Local Environment

```bash
# Install dependencies
npm install

# Create .env.local with all required variables
cat > .env.local << 'EOF'
ANTHROPIC_API_KEY=sk-ant-...
MONGODB_URI=mongodb+srv://user:pass@cluster...
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ADMIN_EMAIL=your-email@example.com
ANTHROPIC_MODEL=claude-sonnet-5
MONGODB_DB=resume_tailor
NODE_ENV=development
EOF

# Verify TypeScript compiles
npm run typecheck

# Build locally
npm run build

# Run tests
npm test -- --run
```

### 2. Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Link project (or create new)
vercel link

# Set environment variables in Vercel dashboard:
# https://vercel.com/dashboard/[project-name]/settings/environment-variables
```

### 3. Vercel Environment Variables

Set these in **Vercel Dashboard → Settings → Environment Variables**:

| Variable | Value | Production | Preview |
|----------|-------|------------|---------|
| `ANTHROPIC_API_KEY` | sk-ant-... | ✓ | ✓ |
| `MONGODB_URI` | mongodb+srv://... | ✓ | ✓ |
| `SESSION_SECRET` | 32-byte-hex | ✓ | ✓ |
| `ADMIN_EMAIL` | your@email.com | ✓ | ✓ |
| `NODE_ENV` | production | ✓ | - |

**Note:** Do NOT set NODE_ENV in preview branches (Vercel handles it).

### 4. Deploy

```bash
# Deploy to production
vercel --prod

# Or deploy via Git
git push origin main  # Auto-deploys if connected
```

## Database Setup

### MongoDB Atlas

1. **Create Organization & Project**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create cluster (M1 free tier recommended for dev)

2. **Create Database User**
   - Database Access → Add New Database User
   - Username: `resumetailor`
   - Password: Generate secure password
   - Permissions: Read and write to any database

3. **Network Access**
   - Network Access → Add IP Address
   - Add 0.0.0.0/0 for Vercel (or specific Vercel IPs)
   - Add your local IP for development

4. **Connection String**
   - Clusters → Connect → Drivers
   - Copy connection string: `mongodb+srv://resumetailor:PASSWORD@cluster.mongodb.net/resume_tailor`

5. **Create Database & Collections**
   - The app creates collections on first use, OR run:
   ```bash
   npm run db:indexes
   ```

## Domain & SSL

### Vercel Custom Domain

1. Go to **Vercel Dashboard → Project → Settings → Domains**
2. Add custom domain
3. Update DNS records (Vercel provides exact values)
4. SSL automatically provisioned (Let's Encrypt)

### Environment Variable for Domain

```bash
# In .env.production
NEXTAUTH_URL=https://your-domain.com
```

## Monitoring & Alerting

### Vercel Analytics

1. Enable in **Settings → Analytics**
2. Tracks:
   - Core Web Vitals
   - Performance metrics
   - Real User Monitoring

### Error Tracking (Sentry)

```bash
npm install @sentry/nextjs

# Initialize in next.config.js
```

See SECURITY.md for Sentry setup.

## Pre-Deployment Checklist

### Code Quality
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] No console.error/warn in logs
- [ ] No debug code left in

### Security
- [ ] All API endpoints validate input
- [ ] All protected routes check auth
- [ ] No hardcoded secrets in code
- [ ] Error messages don't leak system details
- [ ] CORS/CSP headers configured

### Configuration
- [ ] `.env.local` has all required variables
- [ ] SESSION_SECRET is 32+ bytes
- [ ] ADMIN_EMAIL is set and verified
- [ ] MongoDB user has minimal permissions
- [ ] ANTHROPIC_API_KEY is valid

### Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual smoke test (auth flow)

### Documentation
- [ ] SECURITY.md reviewed
- [ ] DEPLOYMENT.md up-to-date
- [ ] .env.example has correct template

## Health Checks

### API Health Endpoint

```bash
curl https://your-domain.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "checks": {
    "mongodb": "connected",
    "anthropic": "available"
  }
}
```

### Monitor Deployment

```bash
# Watch deployment
vercel ls

# View logs
vercel logs

# Tail real-time logs
vercel logs --follow
```

## Rollback

### If deployment has issues:

```bash
# Revert to previous deployment
vercel rollback

# Or push previous commit
git revert HEAD
git push origin main
```

## Performance Tuning

### Cache Configuration

```javascript
// next.config.js
module.exports = {
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
};
```

### Database Connection Pooling

MongoDB Atlas handles connection pooling automatically. Monitor in:
- Atlas Dashboard → Metrics → Connections

### API Response Compression

Vercel enables gzip compression automatically.

## Cost Optimization

### Claude API
- Cache API calls for repeated prompts
- Use Haiku for non-critical operations
- Monitor usage in Anthropic console

### MongoDB
- Use free M1 tier for dev
- M5+ for production with enough connections
- Monitor storage and operations

### Vercel
- Free tier includes:
  - 100 GB-hours bandwidth
  - Unlimited API invocations
  - Analytics included
- Pro: $20/month for priority support

## Troubleshooting

### Build fails

```bash
# Check build output
vercel build --debug

# Local test
npm run build

# Clear cache
rm -rf .next
npm run build
```

### Database connection timeout

- Check MongoDB Atlas network access
- Verify connection string in .env
- Check database user permissions
- Test connection: `mongosh "YOUR_CONNECTION_STRING"`

### API errors

```bash
# View error logs
vercel logs --all

# Check recent deployments
vercel deployments
```

### High latency

- Check Vercel region (Settings → Edge Network)
- Monitor API cold starts
- Check MongoDB query performance

## Maintenance

### Regular Tasks

- **Weekly:** Monitor error logs and performance metrics
- **Monthly:** Review security audit logs, rotate sensitive credentials if needed
- **Quarterly:** Update dependencies, run full test suite

### Updating Dependencies

```bash
# Check for outdated packages
npm outdated

# Update safely
npm update

# Or update specific package
npm install package@latest

# Run tests
npm test -- --run

# Commit and push
git add package.json package-lock.json
git commit -m "chore: update dependencies"
git push origin main
```

### Backup MongoDB

```bash
# Download backup
mongodump --uri="mongodb+srv://user:pass@cluster.mongodb.net/resume_tailor" --out=./backup

# Restore
mongorestore --uri="mongodb+srv://user:pass@cluster.mongodb.net" ./backup
```

## Production Runbook

### On-Call Procedures

**If API returns 500 errors:**
1. Check Vercel logs: `vercel logs`
2. Check MongoDB status: Atlas console
3. Check Claude API status: https://status.anthropic.com
4. Roll back last deployment if recent change

**If users report slow performance:**
1. Check Vercel metrics (analytics dashboard)
2. Check database performance (Atlas → Metrics)
3. Scale if needed (upgrade MongoDB tier)

**If security incident (exposed credentials):**
1. Follow SECURITY.md incident response
2. Rotate all affected credentials
3. Review audit logs
4. Create post-mortem

## Support

- **Documentation:** See SECURITY.md, README.md
- **Vercel Support:** https://vercel.com/support
- **MongoDB Support:** https://www.mongodb.com/support
- **Claude API Issues:** https://support.anthropic.com
