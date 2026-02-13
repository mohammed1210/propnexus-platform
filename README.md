# PropNexus Platform

![Frontend CI](https://github.com/mohammed1210/propnexus-platform/actions/workflows/frontend-ci.yml/badge.svg)
![Backend CI](https://github.com/mohammed1210/propnexus-platform/actions/workflows/backend-ci.yml/badge.svg)

PropNexus is a comprehensive real estate platform for property investment analysis, featuring AI-powered insights, property listings, and subscription-based access.

## Recent Updates (Sprint 11.3 - Nov 2025)

✨ **UI/UX Polish & Consistency**
- Lighter hero gradient with improved contrast
- Prominent "Save" button with heart icon on property cards
- Collapsible filters on listings page for cleaner interface
- Unified panel styling across property detail pages
- Leaflet maps replacing Google Maps for better performance
- Floating Quick Actions sidebar on property details
- Animated AI score bars with count-up effects
- Gated feature panels show locked previews with upgrade prompts

## Features

- 🏠 **Property Listings** - Browse and search properties with advanced filters
- 🤖 **AI Analysis** - Investment summaries and exit strategies powered by GPT-4
- 💰 **Deal Tracking** - Save and manage potential investment opportunities with one click
- 📊 **Analytics** - Property metrics, area intelligence, and comparables
- 🗺️ **Interactive Maps** - Leaflet-powered maps with property markers and heatmaps
- 🔐 **Authentication** - Secure user accounts with Supabase Auth
- 💳 **Subscriptions** - Three-tier plans (Free, Pro, Investor) powered by Stripe
- 👨‍💼 **Admin Dashboard** - Subscriber metrics and MRR tracking

## Subscription Tiers

PropNexus Platform offers three subscription tiers:

1. **Free** - Default tier for all users
   - Access to basic property listings
   - Basic calculators and tools
   - Limited feature access

2. **Pro** - Professional investor tier ($29/month)
   - **7-day free trial** for new subscriptions
   - All free features
   - Advanced analytics
   - Priority support
   - Configurable via `STRIPE_PRICE_PRO` environment variable

3. **Investor** - Premium investor tier ($99/month)
   - **7-day free trial** for new subscriptions
   - All pro features
   - Advanced AI features (when enabled via feature flags)
   - Unlimited saved deals
   - Premium support
   - Configurable via `STRIPE_PRICE_INVESTOR` environment variable

**Note:** The `enterprise` tier has been removed in Sprint 11.2. Only `free`, `pro`, and `investor` tiers are supported.

## Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: React 19
- **Maps**: Leaflet/React-Leaflet
- **Charts**: Chart.js
- **Authentication**: Supabase Auth

### Backend
- **Framework**: FastAPI (Python)
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4
- **Payments**: Stripe
- **Email**: Resend
- **Scraping**: BeautifulSoup, Playwright

### Infrastructure
- **Frontend Hosting**: Vercel
- **Backend Hosting**: Railway
- **Database**: Supabase
- **CI/CD**: GitHub Actions

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.12+
- npm or yarn
- Supabase account
- Stripe account (for payments)

### 1. Clone the Repository
```bash
git clone https://github.com/mohammed1210/propnexus-platform.git
cd propnexus-platform
```

### 2. Install Dependencies

**Root & Frontend:**
```bash
npm install
cd frontend && npm install
```

**Backend:**
```bash
cd backend
pip install -r requirements.txt
```

### 3. Configure Environment Variables

**Frontend** (`frontend/.env.local`):
```bash
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local with your values
```

**Backend** (`backend/.env`):
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your values
```

See environment examples for required variables.

### 4. Set Up Database

1. Create a Supabase project
2. Run the schema:
   ```sql
   -- Copy and paste contents of supabase/schema.sql into Supabase SQL Editor
   ```
3. (Optional) Add seed data from `supabase/seed/`

See [supabase/README.md](supabase/README.md) for detailed setup instructions.

## Debug / Proof: Multi-image scraping

**Admin-only endpoint (backend):**

- `GET /debug/properties-with-multiple-images?limit=10`

Returns property `id`, `source`, and `image_count` for listings where `image_urls` contains 2+ images.

**SQL (Supabase):**

```sql
select id, source, jsonb_array_length(image_urls) as image_count
from properties
where image_urls is not null
order by image_count desc
limit 10;
```

### 5. Run Development Servers

**Frontend:**
```bash
npm run dev
# or
cd frontend && npm run dev
```

**Backend:**
```bash
cd backend
uvicorn main:app --reload
```

## Project Structure

```
.
├── frontend/              # Next.js frontend application
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   ├── lib/              # Utilities and clients
│   └── types/            # TypeScript types
├── backend/              # FastAPI backend application
│   ├── routes/           # API route handlers
│   ├── utils/            # Helper functions
│   └── schemas/          # Pydantic schemas
├── supabase/             # Database schema and policies
│   ├── schema.sql        # Complete database schema
│   ├── policies/         # RLS policies
│   └── seed/             # Seed data
├── docs/                 # Documentation
│   ├── sprint-10-completion.md  # Sprint 10 details
│   └── ...               # Other docs
└── scripts/              # Utility scripts
```

## Environment Configuration

### Auth + Admin Ops (Sprint 11.4)

**Saved Deals + Clerk migration note**

If you enable Clerk authentication, note that Clerk user IDs look like `user_...` (text) and cannot be inserted into the legacy `saved_deals.user_id` UUID column. Apply the Supabase migration in `supabase/migrations/20260213_saved_deals_clerk_user_id.sql` to add `clerk_user_id` and make `user_id` nullable.

**Clerk URL best-practice (use relative paths)**

```env
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/listings
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/listings
```

**Auth debug endpoint**

- `GET /api/debug/auth` returns a runtime snapshot including `vercelEnv`, `commitSha`, publishable key prefix/length/whitespace, and the computed `isAuthEnabled`.

**Admin import (token-based, POST-only)**

```bash
curl -X POST "https://propnexus-platform.vercel.app/api/admin/import-all" \
   -H "content-type: application/json" \
   -H "x-admin-token: <IMPORT_ADMIN_TOKEN>" \
   -d '{"location":"London"}'
```

### Frontend Environment Variables

Required for development and production:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server-side only

# API
NEXT_PUBLIC_API_BASE=http://localhost:8000

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PRICE_PRO=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_INVESTOR=price_xxx

# Feature Flags (Optional - defaults to false)
# AI features are disabled by default for safety and cost control
NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE=false        # Enable AI-powered deal scoring
NEXT_PUBLIC_FEATURE_AI_CHATBOT=false           # Enable AI investment chatbot
NEXT_PUBLIC_FEATURE_AREA_INTEL=false           # Enable area intelligence panel
NEXT_PUBLIC_FEATURE_COMPS=false          # Enable comparable sales panel
```

### Backend Environment Variables

Required for development and production:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# API Keys
OPENAI_API_KEY=sk-xxx
RESEND_API_KEY=re_xxx

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Stripe Price ID Mapping (for subscription tier detection)
# Map Stripe price IDs to plan tiers: pro, investor
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_INVESTOR=price_xxx

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.vercel.app

# Admin ops (recommended in production)
IMPORT_ADMIN_TOKEN=change-me
OFF_MARKET_ADMIN_TOKEN=change-me

# Scrapers
# Modes: direct | scraperapi | smart
SCRAPER_MODE=direct
SCRAPERAPI_KEY=

# Keep Playwright off in production unless explicitly needed.
PLAYWRIGHT_ENABLE=false
```

See the launch checklist: [docs/launch_checklist.md](docs/launch_checklist.md)

## Feature Flags

PropNexus uses feature flags to control AI-powered features. All flags default to `false` for safety and cost control.

**Available Flags:**
- `NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE` - AI-powered investment score (requires OpenAI API key)
- `NEXT_PUBLIC_FEATURE_AI_CHATBOT` - AI chatbot for property advice (requires OpenAI API key)
- `NEXT_PUBLIC_FEATURE_AREA_INTEL` - Area intelligence with demographics and crime data
- `NEXT_PUBLIC_FEATURE_COMPS` - Comparable sales panel

Set flags to `true` or `1` to enable. Example:
```env
NEXT_PUBLIC_FEATURE_AI_CHATBOT=true
NEXT_PUBLIC_FEATURE_AREA_INTEL=1
```

## Subscription Tiers

PropNexus supports three subscription tiers:
- **Free** - Basic property browsing
- **Pro** - Enhanced features and analytics
- **Investor** - Premium features with AI-powered insights

### Tier Management

The `/users/plan` endpoint supports two authentication methods:

1. **Query Parameter** (backward compatible):
   ```bash
   GET /users/plan?email=user@example.com
   ```

2. **Authorization Header** (recommended):
   ```bash
   GET /users/plan
   Authorization: Bearer <jwt-token>
   ```

When both are provided, the Authorization header takes precedence. This ensures upgraded users see their correct tier immediately after refresh.

### Stripe Configuration

Configure price ID mappings in backend environment:
```env
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_INVESTOR=price_xxx
```

Unknown price IDs will NOT downgrade existing users to 'free' - they preserve the current tier.

## Stripe Configuration

### Price IDs
Set up two subscription tiers in Stripe Dashboard:
- **Pro Plan**: Monthly subscription for basic features
- **Investor Plan**: Monthly subscription for premium features

### Webhooks

Configure webhooks in Stripe Dashboard:

**Frontend Webhook** (Vercel):
- URL: `https://your-domain.vercel.app/api/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.*`

**Backend Webhook** (Railway):
- URL: `https://your-backend.railway.app/stripe/webhook`
- Events: `checkout.session.completed`, `customer.subscription.*`

The backend webhook handles database updates; frontend webhook is for logging.

## Admin Dashboard

Access the admin dashboard at `/admin` to view:
- Total active subscribers
- Monthly Recurring Revenue (MRR)
- Investor tier subscriber count

Requires Supabase service role key configured in frontend environment.

## Testing

### Frontend Tests
```bash
cd frontend
npm run test          # Unit tests
npm run e2e          # E2E tests with Playwright
```

### Backend Tests
```bash
cd backend
pytest tests/        # All tests
```

### Type Checking
```bash
npm run typecheck    # Root TypeScript check
cd frontend && npx tsc --noEmit  # Frontend TypeScript
```

### Linting
```bash
cd frontend && npm run lint
```

## Documentation

- [Sprint 10 Completion Report](docs/sprint-10-completion.md) - Latest sprint details
- [Database Setup](supabase/README.md) - Database schema and RLS policies
- [Development Guide](docs/README-DEV.md) - Development workflow
- [Roadmap](docs/po-roadmap.md) - Product roadmap
- [Contributing](docs/CONTRIBUTING.md) - Contribution guidelines

## Deployment

### Overview

PropNexus requires configuration of several services for production deployment. Follow these steps carefully to ensure all components work correctly.

### Prerequisites

Before deploying, ensure you have:
- Supabase project created and configured
- Stripe account (if using subscriptions)
- Vercel account (for frontend)
- Railway account (for backend)
- Optional: Clerk account (if migrating from Supabase Auth)

### Required Environment Variables

#### Frontend (Vercel)

**Critical Production Variables:**
```env
# App Configuration
NEXT_PUBLIC_APP_URL=https://propnexus-platform.vercel.app

# Supabase (Current Auth System)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# API Backend
NEXT_PUBLIC_API_BASE=https://your-backend.railway.app

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PRICE_PRO=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_INVESTOR=price_xxx
```

**Optional - Clerk Authentication (Future Migration):**
```env
# Only needed if migrating from Supabase to Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

#### Backend (Railway)

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# API Keys
OPENAI_API_KEY=sk-xxx
RESEND_API_KEY=re_xxx

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_INVESTOR=price_xxx

# CORS
ALLOWED_ORIGINS=https://propnexus-platform.vercel.app
```

### Deployment Steps

#### 1. Frontend Deployment (Vercel)

1. **Connect Repository:**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your GitHub repository
   - Select `frontend` as the root directory

2. **Configure Build Settings:**
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

3. **Set Environment Variables:**
   - In Vercel project settings → Environment Variables
   - Add all variables listed in "Frontend (Vercel)" section above
   - Set for Production, Preview, and Development environments

4. **Deploy:**
   - Click "Deploy"
   - Wait for build to complete

#### 2. Backend Deployment (Railway)

1. **Connect Repository:**
   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

2. **Configure Service:**
   - Set root directory to `backend`
   - Railway should auto-detect Python/FastAPI

3. **Set Environment Variables:**
   - In Railway project → Variables tab
   - Add all variables listed in "Backend (Railway)" section above

4. **Deploy:**
   - Railway will automatically deploy on push to main

#### 3. Database Setup (Supabase)

1. **Run Schema:**
   ```bash
   # In Supabase SQL Editor
   -- Copy and paste contents of supabase/schema.sql
   ```

2. **Configure RLS Policies:**
   - Navigate to Authentication → Policies
   - Review and enable Row Level Security
   - Apply policies from `supabase/policies/`

3. **Enable Auth Providers:**
   - Go to Authentication → Providers
   - Enable Email (Magic Link)
   - Configure email templates if needed

#### 4. Clerk Configuration (Optional - Future Migration)

If using Clerk instead of Supabase Auth:

1. **Create Clerk Application:**
   - Go to [Clerk Dashboard](https://dashboard.clerk.com)
   - Create new application
   - Note your publishable and secret keys

2. **Configure Redirect URLs:**
   - In Clerk Dashboard → Paths
   - Add these redirect URLs:
     - `https://propnexus-platform.vercel.app/dashboard`
     - `https://propnexus-platform.vercel.app/api/auth/callback`
   - Add callback URLs for sign-in/sign-up

3. **Set Environment Variables:**
   - Add Clerk variables to Vercel as shown above
   - Redeploy frontend after adding variables

#### 5. Stripe Configuration

1. **Create Products:**
   - Go to [Stripe Dashboard](https://dashboard.stripe.com)
   - Create two products:
     - "Pro Plan" - £29/month (with 7-day trial)
     - "Investor Plan" - £99/month (with 7-day trial)
   - Note the price IDs
   - **Note:** Stripe automatically applies the 7-day trial period configured in the checkout session

2. **Configure Webhooks:**

   **Frontend Webhook (Vercel):**
   - Endpoint: `https://propnexus-platform.vercel.app/api/stripe/webhook`
   - Events:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`

   **Backend Webhook (Railway):**
   - Endpoint: `https://your-backend.railway.app/stripe/webhook`
   - Same events as frontend
   - This webhook handles database updates

3. **Update Environment Variables:**
   - Add price IDs to both Vercel and Railway
   - Add webhook secrets to both platforms

#### 6. Verification

After deployment, verify everything works:

1. **Run Configuration Check:**
   ```bash
   npm run validate-config
   ```

2. **Test Critical Paths:**
   - [ ] Homepage loads
   - [ ] Authentication works (sign in/sign up)
   - [ ] Property listings display
   - [ ] Demo page accessible at `/demo`
   - [ ] 404 page shows correctly
   - [ ] Stripe checkout flow
   - [ ] Webhook processing

3. **Check Logs:**
   - Vercel: Functions logs
   - Railway: Application logs
   - Supabase: Database logs
   - Stripe: Webhook delivery logs

### Troubleshooting

**Common Issues:**

1. **404 on Vercel after authentication:**
   - Verify `NEXT_PUBLIC_APP_URL` is set correctly
   - Check Clerk/Supabase redirect URLs match deployed URL
   - Ensure `/dashboard` route exists or redirects properly

2. **Images not loading:**
   - Verify image domains in `next.config.mjs`
   - Check image URLs are accessible
   - Fallback images in `public/images/` exist

3. **Stripe webhooks failing:**
   - Verify webhook signing secrets match
   - Check endpoint URLs are correct
   - Ensure backend is running and accessible

4. **Authentication loops:**
   - Clear browser cookies
   - Verify environment variables are set
   - Check redirect URL configuration

### Post-Deployment Checklist

After successful deployment:

- [ ] Update DNS records (if using custom domain)
- [ ] Configure Clerk redirect URLs in dashboard
- [ ] Set up Stripe webhooks for production
- [ ] Test all authentication flows
- [ ] Verify payment processing works
- [ ] Enable monitoring and error tracking
- [ ] Set up database backups
- [ ] Configure CDN/caching if needed
- [ ] Update documentation with live URLs
- [ ] Test mobile responsiveness

### Monitoring and Maintenance

**Recommended Tools:**
- Vercel Analytics for frontend performance
- Railway metrics for backend monitoring
- Supabase logs for database activity
- Stripe Dashboard for payment tracking
- Sentry for error tracking (optional)

**Regular Tasks:**
- Monitor webhook delivery in Stripe
- Review Supabase database size
- Check for failed authentication attempts
- Update dependencies monthly
- Review and rotate API keys quarterly

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for contribution guidelines.

## License

Copyright © 2025 PropNexus. All rights reserved.

## Support

For issues or questions:
- Open an issue on GitHub
- Check documentation in `/docs`
- Review environment variable setup

-----
_Merged notes preserved from previous main:_
  `price_1SKIBTRvsQUM0wWd1P0WWjCz,price_1SNDCSRvsQUM0wWd5c5RaJiA`
## Stripe env wiring (Vercel -> Frontend)
## Webhook
- **NEXT_PUBLIC_APP_BASE_URL** (Var) — e.g. https://propnexus-platform.vercel.app
- **NEXT_PUBLIC_STRIPE_ALLOWED_PRICE_IDS** (Var) — comma-separated price IDs, e.g.:
- **STRIPE_SECRET_KEY** (Secret) — set in Vercel (Production + Preview).
- Events: checkout.session.completed, customer.subscription.{created,updated,deleted}
- Stripe → Railway endpoint: `https://<railway-backend>/stripe/webhook`
