# Troubleshooting Clerk Webhook 404 Error

This guide helps you diagnose and fix 404 errors when testing the Clerk webhook endpoint.

## Common Causes of 404 Errors

### 1. **App Not Deployed Yet**
The most common cause - the endpoint doesn't exist because the code hasn't been deployed.

**Check:**
```bash
# Try accessing your app
curl https://your-domain.vercel.app
```

**Solution:**
- Deploy your changes to Vercel first
- Wait for deployment to complete (check Vercel dashboard)
- Then configure webhook in Clerk

---

### 2. **Wrong URL Format**

**Common mistakes:**
```
❌ http://your-domain.vercel.app/api/webhooks/clerk  (http not https)
❌ https://your-domain.vercel.app/webhooks/clerk     (missing /api)
❌ https://your-domain.vercel.app/api/webhook/clerk  (webhook not webhooks)
❌ https://your-domain.vercel.app/api/webhooks/clerk/ (trailing slash)
```

**Correct format:**
```
✅ https://your-domain.vercel.app/api/webhooks/clerk
```

---

### 3. **Using Development URL**

**Problem:**
```
❌ http://localhost:3000/api/webhooks/clerk
❌ https://localhost:3000/api/webhooks/clerk
```

Clerk cannot reach localhost URLs.

**Solution:**
- Use your deployed Vercel URL
- For local testing, use a tunnel (see below)

---

### 4. **File Not in Correct Location**

The file must be at:
```
frontend/app/api/webhooks/clerk/route.ts
```

**Not:**
```
❌ frontend/app/api/webhooks/clerk.ts
❌ frontend/app/webhooks/clerk/route.ts
❌ frontend/pages/api/webhooks/clerk.ts
```

---

## Diagnostic Steps

### Step 1: Verify File Exists

```bash
# In your repository
cd frontend
ls -la app/api/webhooks/clerk/route.ts
```

Should output: `route.ts` file exists

---

### Step 2: Check Deployment Status

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Find your project
3. Check latest deployment status
4. Look for "Ready" status

**If still deploying:**
- Wait for deployment to finish
- Check build logs for errors

---

### Step 3: Test Endpoint Directly

```bash
# Replace with your actual domain
curl -X POST https://your-domain.vercel.app/api/webhooks/clerk \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

**Expected responses:**

**✅ Endpoint exists (good):**
```json
{"error": "Missing webhook headers"}  // Status 400
{"error": "Webhook secret not configured"}  // Status 500
```

**❌ Endpoint doesn't exist (404):**
```json
{"error": "Not Found"}  // Status 404
```

---

### Step 4: Check Vercel Logs

1. Vercel Dashboard → Your Project
2. Click on latest deployment
3. Click "View Function Logs"
4. Look for errors related to `/api/webhooks/clerk`

**Common errors:**
- Build errors preventing deployment
- TypeScript errors
- Missing dependencies

---

## Solutions by Scenario

### Scenario A: Code Not Deployed

**Symptoms:**
- Local development works
- Deployed site shows 404
- Recent commits not live

**Solution:**

1. **Check if your branch is deployed:**
   ```bash
   git branch --show-current
   ```
   
2. **Push to correct branch:**
   ```bash
   git push origin your-branch-name
   ```

3. **Trigger deployment in Vercel:**
   - Vercel Dashboard → Your Project → Deployments
   - Click "Redeploy" on latest commit
   - Or connect your PR to Vercel for automatic deployments

4. **Wait for deployment:**
   - Takes 1-3 minutes usually
   - Watch for "Ready" status

5. **Test again:**
   ```bash
   curl -X POST https://your-domain.vercel.app/api/webhooks/clerk
   ```

---

### Scenario B: Using Wrong Domain

**Symptoms:**
- Works on one domain but not another
- Using preview URL instead of production

**Solution:**

1. **Find your correct Vercel URL:**
   - Vercel Dashboard → Project → Domains
   - Use the production domain or latest preview

2. **Common Vercel URL formats:**
   ```
   Production: https://propnexus-platform.vercel.app
   Preview: https://propnexus-platform-git-branch-username.vercel.app
   Custom: https://app.yourdomain.com
   ```

3. **Update Clerk webhook URL:**
   - Copy the correct URL
   - Go to Clerk Dashboard → Webhooks
   - Edit your endpoint
   - Update URL
   - Save

---

### Scenario C: Build Failures

**Symptoms:**
- Deployment shows "Error" status
- Logs show TypeScript or build errors
- Old version still deployed

**Solution:**

1. **Check build logs in Vercel:**
   - Look for red error messages
   - Note the file and line number

2. **Common issues:**
   ```typescript
   // Missing dependencies
   npm install svix @clerk/nextjs @supabase/supabase-js
   
   // TypeScript errors
   // Fix type issues in route.ts
   ```

3. **Fix and redeploy:**
   ```bash
   # Fix the issues locally
   npm run build  # Test build works
   git add .
   git commit -m "Fix build errors"
   git push
   ```

---

### Scenario D: Route Configuration Issues

**Symptoms:**
- File exists
- Build succeeds
- Still getting 404

**Solution:**

1. **Verify Next.js version supports App Router:**
   ```bash
   # Check package.json
   grep "next" frontend/package.json
   ```
   Should be 13+ for App Router

2. **Check file structure:**
   ```
   frontend/
   └── app/
       └── api/
           └── webhooks/
               └── clerk/
                   └── route.ts  ← Must be named "route.ts"
   ```

3. **Verify export syntax:**
   ```typescript
   // In route.ts
   export async function POST(req: Request) {
     // handler code
   }
   ```

4. **Check for middleware conflicts:**
   - Look at `frontend/middleware.ts`
   - Ensure it's not blocking `/api/webhooks/*`

---

## Testing Locally with ngrok

If you want to test the webhook before deploying:

### Step 1: Install ngrok

```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

### Step 2: Start your Next.js app

```bash
cd frontend
npm run dev
# App runs on http://localhost:3000
```

### Step 3: Create tunnel

```bash
ngrok http 3000
```

You'll see:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

### Step 4: Use ngrok URL in Clerk

In Clerk Dashboard, use:
```
https://abc123.ngrok.io/api/webhooks/clerk
```

**Note:** ngrok URL changes each time you restart it (unless you have a paid plan)

---

## Quick Verification Checklist

Before configuring webhook in Clerk:

- [ ] Code is committed and pushed
- [ ] Vercel deployment shows "Ready" status
- [ ] Can access main site at `https://your-domain.vercel.app`
- [ ] Tested endpoint with curl (gets 400/500, not 404)
- [ ] Using correct URL format with https://
- [ ] No trailing slash in URL
- [ ] Environment variables are set in Vercel

---

## After Fixing 404

Once endpoint responds (even with 400/500 errors):

1. **Configure webhook in Clerk:**
   - Dashboard → Webhooks → Add Endpoint
   - Enter working URL
   - Select events: `user.created`, `user.updated`
   - Save

2. **Copy webhook secret:**
   - Copy the `whsec_xxx` secret shown

3. **Add to Vercel environment variables:**
   - Settings → Environment Variables
   - Add `CLERK_WEBHOOK_SECRET=whsec_xxx`
   - Redeploy

4. **Test end-to-end:**
   - Create a test user in your app
   - Check webhook delivery in Clerk Dashboard
   - Verify user in Supabase database

---

## Still Getting 404?

If you've tried everything above:

### Check Next.js Version

```bash
cd frontend
cat package.json | grep '"next"'
```

If < 13.0.0, you may need to use Pages Router instead:
```
frontend/pages/api/webhooks/clerk.ts  (not route.ts)
```

### Check Vercel Function Logs

1. Vercel Dashboard → Your deployment
2. Functions tab
3. Look for `/api/webhooks/clerk`
4. Check if function is created

### Check Build Output

In Vercel build logs, search for:
```
Routes (App Router):
...
POST /api/webhooks/clerk
```

If not listed, route isn't being detected.

---

## Need More Help?

1. **Check actual error in Clerk:**
   - Clerk Dashboard → Webhooks → Your endpoint → Attempts
   - Look at the error details

2. **Share deployment URL for debugging:**
   - Provide the exact URL you're using
   - Share any error messages from Clerk

3. **Verify branch is deployed:**
   - Check which branch Vercel is deploying
   - Ensure latest changes are in that branch

---

## Summary: Most Common Solution

**90% of 404 errors are because:**

1. ✅ **Code not deployed yet** - Deploy to Vercel first
2. ✅ **Using localhost URL** - Use deployed Vercel URL
3. ✅ **Typo in URL** - Double-check spelling and format

**Quick fix:**
```bash
# 1. Ensure code is pushed
git push origin your-branch

# 2. Wait for Vercel deployment (check dashboard)

# 3. Test endpoint
curl -X POST https://your-actual-domain.vercel.app/api/webhooks/clerk

# 4. If you get 400/500 (not 404), you're good!
#    Now configure in Clerk with that exact URL
```
