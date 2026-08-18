# TypeScript Best Practices for Vercel Deployment

## TypeScript Configuration for Vercel

### Current Configuration (`tsconfig.json`)

Your project already has Vercel-optimized TypeScript settings:

```json
{
  "compilerOptions": {
    "target": "ES2020",              // Modern target, Vercel supports it
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,                  // ✅ All strict checks enabled
    "noEmit": true,                  // ✅ Let Next.js handle emit
    "isolatedModules": true,         // ✅ Each file is independent
    "jsx": "preserve",               // ✅ Let Next.js handle JSX
    "moduleResolution": "bundler",   // ✅ Vercel preferred
    "resolveJsonModule": true
  }
}
```

## Why These Settings Matter for Vercel

### `strict: true`
- Catches type errors at build time
- Prevents runtime errors on Vercel
- Vercel builds fail cleanly (not at runtime)

### `noEmit: true`
- Disables TypeScript compilation
- Next.js uses SWC instead (faster)
- Avoids double-compilation

### `isolatedModules: true`
- Each file is independently valid TypeScript
- Critical for serverless functions
- Ensures predictable bundling on Vercel

### `moduleResolution: "bundler"`
- Designed for Next.js bundler
- Vercel expects this setting
- Better path resolution

## Current Status

✅ **Your TypeScript configuration is Vercel-compliant**

### Build Check Result
```bash
npm run typecheck
# Output: [No errors]
```

## Common TypeScript Errors & Fixes

### Error: "Object is of type 'unknown'"

**Problem**: Using `Promise.race` with mixed types

**Before**:
```typescript
const response = await Promise.race([
  apiCall(),
  timeoutPromise(),
]);
// response is 'unknown'
response.content[0].text // ❌ Error
```

**After**:
```typescript
const response = await Promise.race([
  apiCall() as Promise<{ content: Array<{ text: string }> }>,
  timeoutPromise(),
]);
// response is typed correctly
response.content[0].text // ✅ Works
```

### Error: "Type 'X' is not assignable to type 'Y'"

**Problem**: Implicit type mismatches

**Before**:
```typescript
const data: Record<string, unknown> = {};
const value: string = data.key; // ❌ Type mismatch
```

**After**:
```typescript
const data: Record<string, unknown> = {};
const value: string = String(data.key); // ✅ Explicit conversion
```

### Error: "Property does not exist on type 'never'"

**Problem**: Missing optional chaining

**Before**:
```typescript
const value = obj.nested.deep.value; // ❌ May be undefined
```

**After**:
```typescript
const value = obj?.nested?.deep?.value; // ✅ Safe access
```

## Best Practices for Vercel

### 1. **Always Type API Route Responses**

```typescript
// ❌ Bad
export async function GET(req: Request) {
  return Response.json({ data: someData });
}

// ✅ Good
interface ResponseData {
  data: string[];
  error?: string;
}

export async function GET(req: Request): Promise<Response> {
  const data: ResponseData = { data: [] };
  return Response.json(data);
}
```

### 2. **Type Async Functions Explicitly**

```typescript
// ❌ Bad - implicit return type
async function processData(input: string) {
  return await someApiCall(input);
}

// ✅ Good - explicit return type
async function processData(input: string): Promise<ProcessedData> {
  return await someApiCall(input);
}
```

### 3. **Use Type Guards for Unknown Types**

```typescript
// ❌ Bad
const value: unknown = getData();
console.log(value.property); // ❌ Error

// ✅ Good
const value: unknown = getData();
if (typeof value === 'object' && value !== null && 'property' in value) {
  console.log((value as { property: string }).property);
}
```

### 4. **Proper Error Handling with Types**

```typescript
// ❌ Bad
try {
  await operation();
} catch (error) {
  console.log(error.message); // ❌ error is 'unknown'
}

// ✅ Good
try {
  await operation();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.log(message);
}
```

### 5. **Type Environment Variables**

```typescript
// ❌ Bad
const apiKey = process.env.ANTHROPIC_API_KEY;

// ✅ Good
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required');

// Or create a typed config:
const config = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: (process.env.ANTHROPIC_MODEL || 'claude-sonnet-5') as string,
  },
} as const;
```

### 6. **Use `satisfies` for Object Validation (TS 4.9+)**

```typescript
// ✅ Verify object shape without explicit type
const config = {
  apiKey: process.env.API_KEY,
  timeout: 5000,
  retries: 3,
} satisfies Record<string, string | number>;
```

## File-by-File TypeScript Guide

### API Routes (`app/api/**/*.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs'; // ✅ Explicit runtime
export const dynamic = 'force-dynamic'; // ✅ No static gen

interface RequestBody {
  url: string;
}

interface ResponseData {
  success: boolean;
  jobId?: string;
  error?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as RequestBody; // ✅ Type assertion
    
    if (!body.url) {
      return NextResponse.json<ResponseData>(
        { success: false, error: 'URL required' },
        { status: 400 }
      );
    }

    // ... process
    
    return NextResponse.json<ResponseData>(
      { success: true, jobId: '123' },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json<ResponseData>(
      { success: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}
```

### Client Components (`components/**/*.tsx`)

```typescript
'use client'; // ✅ Always include

import { useState, ReactNode } from 'react'; // ✅ Proper imports

interface Props {
  children: ReactNode;
  onSubmit?: (data: FormData) => Promise<void>;
}

export default function Form({ children, onSubmit }: Props) {
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      await onSubmit?.(formData);
    } catch (error) {
      console.error('Submit failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {children}
    </form>
  );
}
```

### Server Components (`app/**/*.tsx`)

```typescript
import { notFound } from 'next/navigation'; // ✅ Next.js utilities

interface PageProps {
  params: { id: string };
  searchParams: Record<string, string | string[]>;
}

export default async function Page({ params, searchParams }: PageProps) {
  // ✅ Fetch data server-side
  const data = await fetchData(params.id);
  
  if (!data) notFound();
  
  return <div>{/* ... */}</div>;
}
```

## Testing TypeScript

### Before Deployment

```bash
# 1. Run type checking
npm run typecheck

# 2. Run build (catches type errors)
npm run build

# 3. Check for unused code
npm run lint

# 4. Run tests
npm run test
```

### CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/typescript.yml`:

```yaml
name: TypeScript Check

on: [push, pull_request]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
```

## Strict Mode Compliance Checklist

Before deploying to Vercel, ensure:

- [ ] No `any` types in API routes
- [ ] All function return types explicitly typed
- [ ] All `catch` errors are handled as unknown
- [ ] Environment variables are validated on load
- [ ] Optional properties use `?` properly
- [ ] No non-null assertions (`!`) without explanation
- [ ] `null` vs `undefined` are handled explicitly
- [ ] All Promise chains have `.catch()` or try/catch

## Common Vercel Build Failures & Solutions

### Build fails: "Type 'x' is not assignable to 'y'"

```bash
# Fix: Add proper type assertion
# File: app/api/your-route.ts

// Change:
const data = await promise; // ❌

// To:
const data = (await promise) as ExpectedType; // ✅
```

### Build fails: "Cannot find module '@/lib/something'"

```bash
# Fix: Check path alias in tsconfig.json
# Verify: "paths": { "@/*": ["./*"] }

# Reload TypeScript in editor:
# VS Code: Ctrl+Shift+P → "TypeScript: Restart TS Server"
```

### Build fails: "Property 'x' does not exist on type 'Node'"

```typescript
// Fix: Use optional chaining
obj.nested.property // ❌
obj?.nested?.property // ✅
```

## Performance Optimization

### Reduce Type Checking Time

1. Use `skipLibCheck: true` (already set) - skips type checking in node_modules
2. Limit recursive type constraints
3. Use `interface` instead of `type` for object shapes (slightly faster)

### Code Size Optimization

```typescript
// ❌ Large type imports
import type { LotsOfTypes } from './types';

// ✅ Only import needed types
import type { SpecificType } from './types';
```

## Resources

- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **Vercel + TypeScript**: https://vercel.com/docs/concepts/frameworks/nextjs
- **TypeScript Compiler Options**: https://www.typescriptlang.org/tsconfig

---

**Your project is fully optimized for Vercel deployment!** ✅

All TypeScript configurations follow Vercel best practices and ensure reliable, type-safe deployments.
