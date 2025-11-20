# Clerk Webhook Setup Guide - Step by Step

This guide walks you through setting up the Clerk webhook in the Clerk Dashboard to sync users to your Supabase database.

## Prerequisites

- Clerk account with an application created
- Your application deployed to Vercel (or another hosting provider)
- The webhook endpoint code deployed (`/api/webhooks/clerk`)

## Step-by-Step Instructions

### Step 1: Access Clerk Dashboard

1. Go to [https://dashboard.clerk.com](https://dashboard.clerk.com)
2. Sign in to your account
3. Select your application from the list (or create one if you haven't already)

---

### Step 2: Navigate to Webhooks Section

1. In the left sidebar, look for **"Webhooks"** (usually under the "Developers" or "Configure" section)
2. Click on **"Webhooks"**
3. You should see a page that says "Webhooks" at the top with an "Add Endpoint" button

**Visual Location:**
```
Dashboard Navigation:
├── Overview
├── Users
├── Sessions  
├── Configure
│   └── Webhooks  ← Click here
├── Developers
└── Settings
```

---

### Step 3: Add New Webhook Endpoint

1. Click the **"Add Endpoint"** button (usually blue, in the top right)
2. A form will appear asking for webhook details

---

### Step 4: Configure Webhook URL

1. In the **"Endpoint URL"** field, enter your webhook endpoint:
   ```
   https://your-domain.vercel.app/api/webhooks/clerk
   ```
   
   **Examples:**
   - Production: `https://propnexus-platform.vercel.app/api/webhooks/clerk`
   - Staging: `https://propnexus-platform-staging.vercel.app/api/webhooks/clerk`
   - Custom domain: `https://app.propnexus.com/api/webhooks/clerk`

2. Make sure the URL is correct - it should:
   - Start with `https://` (not `http://`)
   - End with `/api/webhooks/clerk`
   - Match your actual deployed domain

**Important Notes:**
- ⚠️ The endpoint must be live and accessible before you add it
- ⚠️ Don't use `localhost` - Clerk cannot reach local endpoints
- ✅ Test your endpoint is working: Visit `https://your-domain.vercel.app/api/webhooks/clerk` in a browser
  - You should get a response (even if it's an error, it proves the endpoint exists)

---

### Step 5: Subscribe to Events

1. After entering the URL, you'll see a section called **"Subscribe to events"** or **"Message Filtering"**
2. You need to select which events this webhook should receive

**Select these events:**
- ✅ **`user.created`** - Fires when a new user signs up
- ✅ **`user.updated`** - Fires when a user's information changes (like email)

**How to select:**
- You may see a searchable list or checkboxes
- Type "user" to filter events
- Check the boxes for `user.created` and `user.updated`
- Make sure both are selected before continuing

**Why these events?**
- `user.created`: Creates the user in your Supabase database when they sign up
- `user.updated`: Updates the user's email if they change it in Clerk

**Optional events** (you can add later if needed):
- `user.deleted` - If you want to handle user deletion
- `session.created` - For session tracking
- `email.created` - For email verification tracking

---

### Step 6: Name Your Endpoint (Optional)

1. Some versions of Clerk Dashboard have a **"Description"** or **"Name"** field
2. Give it a descriptive name like:
   - "Production User Sync"
   - "Supabase User Webhook"
   - "User Created Handler"

This helps you identify the webhook later if you have multiple endpoints.

---

### Step 7: Create the Endpoint

1. Review your settings:
   - ✅ URL is correct
   - ✅ `user.created` is selected
   - ✅ `user.updated` is selected
2. Click **"Create"** or **"Add Endpoint"** button
3. The webhook will be created and you'll see it in your list

---

### Step 8: Copy the Webhook Secret

**This is the most important step!**

1. After creating the endpoint, Clerk will show you the **Signing Secret**
2. It looks like: `whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
3. **Copy this secret immediately** - you may not be able to see it again!

**Where to find it:**
- Right after creating: It's displayed on screen
- Later: Click on your webhook endpoint in the list, then look for "Signing Secret" or "Webhook Secret"
- Some versions hide it and show "Reveal" button - click to see it

**Security Note:**
- 🔒 Treat this like a password
- 🔒 Never commit it to your repository
- 🔒 Only store it in environment variables

---

### Step 9: Add Secret to Environment Variables

Now you need to add this secret to your application's environment variables.

#### For Vercel:

1. Go to [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project (e.g., "propnexus-platform")
3. Click **"Settings"** tab
4. Click **"Environment Variables"** in the left sidebar
5. Click **"Add New"** button
6. Enter:
   - **Key:** `CLERK_WEBHOOK_SECRET`
   - **Value:** `whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (paste the secret you copied)
   - **Environments:** Select "Production", "Preview", and "Development" (or just Production for now)
7. Click **"Save"**

#### For Other Hosting (Railway, Render, etc.):

1. Go to your hosting dashboard
2. Find your project
3. Navigate to "Environment Variables" or "Config Vars"
4. Add: `CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
5. Save and redeploy if necessary

---

### Step 10: Redeploy Your Application (if needed)

Some hosting platforms require a redeploy after adding environment variables:

**Vercel:**
- New environment variables are automatically available in new deployments
- To force a redeploy: Go to Deployments → Click "..." on latest → "Redeploy"

**Railway/Render:**
- Usually redeploys automatically when you add env vars
- Check your deployment logs to confirm

---

### Step 11: Test the Webhook

Now verify that everything is working:

#### Option A: Test in Clerk Dashboard (Recommended)

1. In Clerk Dashboard, go back to **Webhooks**
2. Click on your webhook endpoint
3. Look for a **"Send Test Event"** or **"Testing"** section
4. Select `user.created` event
5. Click **"Send Test"**
6. Check the response:
   - ✅ Status 200 = Success!
   - ❌ Status 4xx/5xx = Something is wrong

**Check Logs:**
- Vercel: Go to your project → Deployments → Latest → Click "View Function Logs"
- Look for: `[Clerk Webhook] Processing event: user.created`

#### Option B: Create a Test User

1. Open your application (e.g., `https://your-domain.vercel.app`)
2. Go to the sign-up page (`/sign-up`)
3. Create a test account with a unique email (e.g., `test-webhook@example.com`)
4. After signing up, check:
   - ✅ Can you access the site?
   - ✅ Do you see your email in the account page?

**Verify in Supabase:**
1. Go to your Supabase project
2. Click **"Table Editor"**
3. Select **"users"** table
4. Look for your test email
5. Check that `plan` = `'free'`

If you see the user in the database, **success!** 🎉

---

### Step 12: Monitor Webhook Deliveries

After setup, keep an eye on webhook deliveries:

#### In Clerk Dashboard:

1. Go to **Webhooks**
2. Click on your endpoint
3. Look for **"Recent Deliveries"** or **"Attempts"** tab
4. You'll see:
   - ✅ Successful deliveries (200 status)
   - ❌ Failed deliveries (4xx/5xx status)
   - ⏱️ Response times

**Healthy webhook:**
- Success rate: >99%
- Response time: <1000ms
- No repeated failures

**If you see failures:**
- Check the error message
- Verify your `CLERK_WEBHOOK_SECRET` is correct
- Check Vercel function logs for errors
- Ensure Supabase credentials are set

---

## Complete Environment Variables Checklist

Make sure you have ALL of these in your Vercel environment variables:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx
CLERK_WEBHOOK_SECRET=whsec_xxx  ← You just added this!

# Clerk Redirect URLs
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/account
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/account

# Supabase (for webhook to write to)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Stripe (for subscription management)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_STRIPE_PRICE_PRO=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_INVESTOR=price_xxx

# API Backend
NEXT_PUBLIC_API_BASE=https://your-backend.railway.app
```

---

## Troubleshooting

### Problem: Webhook not receiving events

**Check:**
1. Is the URL correct? (https, correct domain, /api/webhooks/clerk)
2. Is the endpoint deployed and accessible?
3. Are the events selected? (user.created, user.updated)
4. Visit the URL in a browser - does it respond?

**Solution:**
- Verify URL in Clerk Dashboard
- Test endpoint: `curl https://your-domain.vercel.app/api/webhooks/clerk` (should return 400, not 404)

---

### Problem: Webhook returns 400 "Invalid signature"

**Cause:** Wrong `CLERK_WEBHOOK_SECRET` or secret not set

**Solution:**
1. Go back to Clerk Dashboard → Webhooks → Your endpoint
2. Copy the signing secret again (click "Reveal" if hidden)
3. Update `CLERK_WEBHOOK_SECRET` in Vercel
4. Redeploy
5. Test again

---

### Problem: Webhook returns 500 error

**Cause:** Error in webhook code or Supabase connection issue

**Solution:**
1. Check Vercel function logs for error details
2. Verify Supabase credentials are set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Test Supabase connection in Supabase dashboard
4. Check if `users` table exists with correct schema

---

### Problem: User created in Clerk but not in Supabase

**Check:**
1. Clerk Dashboard → Webhooks → Recent Deliveries
   - Was it sent? ✅
   - What was the response? (200 = good, 4xx/5xx = error)
2. Vercel function logs
   - Look for `[Clerk Webhook] User created successfully`
   - Or error messages

**Solution:**
- If webhook wasn't sent: Check event subscriptions
- If webhook failed: Check error in logs, fix, then manually retry in Clerk Dashboard

---

### Problem: Cannot see signing secret

**Solution:**
- You may need to regenerate it:
  1. In Clerk Dashboard, click your webhook
  2. Look for "Regenerate Secret" or "Rotate Secret"
  3. Click it to get a new secret
  4. Copy the new secret immediately
  5. Update in Vercel environment variables
  6. Test again

---

## Summary Checklist

Use this to verify everything is set up correctly:

- [ ] Clerk application created
- [ ] Webhook endpoint added in Clerk Dashboard
- [ ] Webhook URL is correct: `https://your-domain.vercel.app/api/webhooks/clerk`
- [ ] Events selected: `user.created` and `user.updated`
- [ ] Signing secret copied
- [ ] `CLERK_WEBHOOK_SECRET` added to Vercel environment variables
- [ ] Application redeployed (if needed)
- [ ] Test webhook sent successfully
- [ ] Test user created and appears in Supabase `users` table
- [ ] Webhook deliveries showing 200 status in Clerk Dashboard
- [ ] No errors in Vercel function logs

---

## Next Steps After Setup

Once the webhook is working:

1. **Test the full flow:**
   - Sign up → Check Supabase → Navigate to pricing → Upgrade → Check plan updates

2. **Monitor for 24 hours:**
   - Check webhook delivery success rate
   - Watch for any errors in logs
   - Verify all new sign-ups appear in database

3. **Set up alerts** (optional):
   - Configure Vercel to alert on function errors
   - Set up Supabase alerts for failed inserts

4. **Document your setup:**
   - Note down your webhook URL
   - Save a screenshot of successful deliveries
   - Keep your secret in a password manager

---

## Getting Help

If you're still stuck after following this guide:

1. **Check the main documentation:** `docs/clerk-auth-integration.md`
2. **Review webhook code:** `frontend/app/api/webhooks/clerk/route.ts`
3. **Check Vercel logs:** Deployments → Latest → View Function Logs
4. **Check Clerk logs:** Webhooks → Your endpoint → Recent Deliveries
5. **Verify environment variables:** Settings → Environment Variables

---

## Quick Reference

**Webhook URL Format:**
```
https://[your-domain]/api/webhooks/clerk
```

**Required Events:**
- `user.created`
- `user.updated`

**Environment Variable:**
```
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Test Command:**
```bash
curl -X POST https://your-domain.vercel.app/api/webhooks/clerk \
  -H "Content-Type: application/json" \
  -d '{"type":"user.created","data":{}}'
# Should return 400 "Invalid signature" (proves endpoint works)
```

**Success Indicators:**
- ✅ Webhook deliveries show 200 status
- ✅ New users appear in Supabase `users` table
- ✅ Users have `plan = 'free'`
- ✅ No errors in Vercel logs

---

**Estimated Time:** 5-10 minutes  
**Difficulty:** Easy (just copy-paste and click buttons)  
**Prerequisites:** Deployed application, Clerk account, Supabase database

Good luck! 🚀
