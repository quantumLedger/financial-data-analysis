# Environment Configuration Guide

This project supports two environments: **local** and **production**, allowing you to switch between localhost and production backend URLs.

---

## Environment Files

### `.env.local`
Used for local development. Loads automatically when running `npm run dev` or when `ENV_FILE=local`.

### `.env.prod`
Used for production builds. Loads when `ENV_FILE=prod` or `NODE_ENV=production`.

---

## Setup Instructions

### 1. Create Environment Files

Copy the example files and update with your values:

```bash
# For local development
cp .env.local.example .env.local

# For production
cp .env.prod.example .env.prod
```

### 2. Configure Backend URLs

**`.env.local`**:
```env
BACKEND_API_URL_LOCAL=http://localhost:8000
ENV_FILE=local
```

**`.env.prod`**:
```env
BACKEND_API_URL_PROD=https://apis.weidentify.ai
ENV_FILE=prod
```

---

## Running the Application

### Local Development

**Default (uses .env.local automatically)**:
```bash
npm run dev
```

**Explicitly set to local**:
```bash
npm run dev:local
```

**Use production backend in development**:
```bash
npm run dev:prod
```

### Production Build

**Default (production mode)**:
```bash
npm run build
npm start
```

**Explicitly set to production**:
```bash
npm run build:prod
npm run start:prod
```

**Build for local testing**:
```bash
npm run build:local
npm run start:local
```

---

## How It Works

### Environment Detection

The `lib/config.ts` file determines which backend URL to use:

1. **Checks `ENV_FILE` environment variable**:
   - `ENV_FILE=local` → Uses `BACKEND_API_URL_LOCAL`
   - `ENV_FILE=prod` → Uses `BACKEND_API_URL_PROD`

2. **Falls back to `NODE_ENV`**:
   - `NODE_ENV=development` → Uses local URL
   - `NODE_ENV=production` → Uses production URL

3. **Final fallback**:
   - Uses `BACKEND_API_URL` if set
   - Defaults to `https://apis.weidentify.ai`

### Priority Order

```
ENV_FILE=prod/prod → BACKEND_API_URL_PROD
ENV_FILE=local → BACKEND_API_URL_LOCAL
NODE_ENV=production → BACKEND_API_URL_PROD
NODE_ENV=development → BACKEND_API_URL_LOCAL
BACKEND_API_URL (if set)
Default: https://apis.weidentify.ai
```

---

## Environment Variables

### Required Variables

| Variable | Local | Production | Description |
|----------|-------|------------|-------------|
| `BACKEND_API_URL_LOCAL` | ✅ | ❌ | Local backend URL (e.g., `http://localhost:8000`) |
| `BACKEND_API_URL_PROD` | ❌ | ✅ | Production backend URL (e.g., `https://apis.weidentify.ai`) |
| `ANTHROPIC_API_KEY` | ✅ | ✅ | Anthropic API key |
| `PERPLEXITY_API_KEY` | ✅ | ✅ | Perplexity API key |

### Optional Variables

| Variable | Description |
|----------|-------------|
| `ENV_FILE` | Force environment: `local` or `prod` |
| `BACKEND_API_URL` | Override default backend URL (used if env-specific URL not set) |

---

## Examples

### Example 1: Local Development

**`.env.local`**:
```env
BACKEND_API_URL_LOCAL=http://localhost:8000
ENV_FILE=local
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...
```

**Run**:
```bash
npm run dev
```

**Result**: All API calls go to `http://localhost:8000`

---

### Example 2: Testing Production Backend Locally

**`.env.prod`**:
```env
BACKEND_API_URL_PROD=https://apis.weidentify.ai
ENV_FILE=prod
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...
```

**Run**:
```bash
npm run dev:prod
```

**Result**: Development server uses production backend URL

---

### Example 3: Production Build

**`.env.prod`**:
```env
BACKEND_API_URL_PROD=https://apis.weidentify.ai
ENV_FILE=prod
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...
```

**Run**:
```bash
npm run build:prod
npm run start:prod
```

**Result**: Production build uses production backend URL

---

## Windows Users

If you're on Windows, the `ENV_FILE` syntax in package.json scripts might not work. Use one of these alternatives:

### Option 1: Use cross-env

Install cross-env:
```bash
npm install --save-dev cross-env
```

Update package.json:
```json
{
  "scripts": {
    "dev:local": "cross-env ENV_FILE=local next dev",
    "dev:prod": "cross-env ENV_FILE=prod next dev"
  }
}
```

### Option 2: Set Environment Variable Manually

**PowerShell**:
```powershell
$env:ENV_FILE="local"; npm run dev
$env:ENV_FILE="prod"; npm run dev
```

**Command Prompt**:
```cmd
set ENV_FILE=local && npm run dev
set ENV_FILE=prod && npm run dev
```

### Option 3: Use .env Files Directly

Next.js automatically loads `.env.local` in development and `.env.production` in production builds. You can:

1. Create `.env.local` for local development
2. Create `.env.production` for production builds
3. The config will automatically detect based on `NODE_ENV`

---

## Troubleshooting

### Issue: Still hitting production URL in local development

**Solution**: Check that `.env.local` exists and contains:
```env
BACKEND_API_URL_LOCAL=http://localhost:8000
ENV_FILE=local
```

### Issue: Environment variable not being read

**Solution**: 
1. Restart the dev server after changing `.env` files
2. Ensure variable names match exactly (case-sensitive)
3. Check that `.env.local` or `.env.prod` is in the project root

### Issue: Windows scripts not working

**Solution**: Use `cross-env` package or set environment variables manually (see Windows Users section above)

---

## Verification

To verify which backend URL is being used, check the console logs when making API calls. The backend URL will be logged in error messages.

You can also add a temporary log in `lib/config.ts`:
```typescript
export function getBackendApiUrl(): string {
  const url = /* ... existing logic ... */;
  console.log('Using backend URL:', url);
  return url;
}
```

---

## Best Practices

1. **Never commit `.env.local` or `.env.prod`** - They're in `.gitignore`
2. **Use `.env.local.example` and `.env.prod.example`** - Commit these as templates
3. **Document required variables** - Keep this guide updated
4. **Test both environments** - Verify local and prod URLs work before deploying
5. **Use different API keys** - Consider using test keys for local development
