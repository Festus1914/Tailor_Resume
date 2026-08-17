#!/bin/bash
set -e

echo "🔍 Pre-deployment verification..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

passed=0
failed=0

check() {
  local name=$1
  local command=$2

  echo -n "  ✓ $name... "
  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
    ((passed++))
  else
    echo -e "${RED}FAIL${NC}"
    ((failed++))
  fi
}

# Type check
echo "TypeScript checks:"
check "Type checking" "npm run typecheck"

# Build
echo ""
echo "Build verification:"
check "Next.js build" "npm run build"

# Environment variables
echo ""
echo "Environment configuration:"

required_vars=(
  "ANTHROPIC_API_KEY:Anthropic API key"
  "MONGODB_URI:MongoDB connection string"
  "SESSION_SECRET:Session secret (32+ bytes)"
  "ADMIN_EMAIL:Admin email address"
)

for var_pair in "${required_vars[@]}"; do
  IFS=':' read -r var_name description <<< "$var_pair"
  var_value=$(eval "echo \$${var_name}")

  if [ -z "$var_value" ]; then
    echo -e "  ${RED}✗${NC} Missing: $description"
    ((failed++))
  else
    echo -e "  ${GREEN}✓${NC} Found: $description"
    ((passed++))
  fi
done

# Security checklist
echo ""
echo "Security checks:"

# Check .env.local is in .gitignore
if grep -q "\.env\.local" .gitignore 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} .env.local is gitignored"
  ((passed++))
else
  echo -e "  ${YELLOW}⚠${NC} Warning: .env.local may not be in .gitignore"
fi

# Check SESSION_SECRET length
if [ -n "$SESSION_SECRET" ]; then
  secret_length=${#SESSION_SECRET}
  if [ "$secret_length" -ge 32 ]; then
    echo -e "  ${GREEN}✓${NC} SESSION_SECRET is secure length ($secret_length chars)"
    ((passed++))
  else
    echo -e "  ${RED}✗${NC} SESSION_SECRET is too short (need 32+, got $secret_length)"
    ((failed++))
  fi
fi

# Check for hardcoded secrets in code
echo ""
echo "Scanning for hardcoded secrets:"
suspicious_patterns=("sk-ant-" "mongodb" "ANTHROPIC_API_KEY=" "MONGODB_URI=")
found_secrets=false

for pattern in "${suspicious_patterns[@]}"; do
  if grep -r "$pattern" --include="*.ts" --include="*.tsx" --include="*.js" \
    --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git . 2>/dev/null | \
    grep -v ".env.example" | grep -v "SECURITY.md" | grep -v "DEPLOYMENT.md" > /dev/null; then
    echo -e "  ${RED}✗${NC} Suspicious pattern found: $pattern"
    found_secrets=true
    ((failed++))
  fi
done

if [ "$found_secrets" = false ]; then
  echo -e "  ${GREEN}✓${NC} No hardcoded secrets detected"
  ((passed++))
fi

# Test scripts check
echo ""
echo "Test configuration:"
if [ -f "package.json" ] && grep -q '"test"' package.json; then
  echo -e "  ${GREEN}✓${NC} Test scripts configured in package.json"
  ((passed++))
else
  echo -e "  ${YELLOW}⚠${NC} Test scripts not configured"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: ${GREEN}$passed passed${NC}, ${RED}$failed failed${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $failed -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed! Ready to deploy.${NC}"
  exit 0
else
  echo -e "${RED}❌ Fix the above issues before deploying.${NC}"
  exit 1
fi
