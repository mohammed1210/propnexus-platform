# PropNexus Platform

![Frontend CI](https://github.com/mohammed1210/propnexus-platform/actions/workflows/frontend-ci.yml/badge.svg)
![Backend CI](https://github.com/mohammed1210/propnexus-platform/actions/workflows/backend-ci.yml/badge.svg)

PropNexus is a comprehensive real estate platform for property investment analysis, featuring AI-powered insights, property listings, and subscription-based access.

## Features

- 🏠 **Property Listings** - Browse and search properties from multiple sources
- 🤖 **AI Analysis** - Investment summaries and exit strategies powered by GPT-4
- 💰 **Deal Tracking** - Save and manage potential investment opportunities
- 📊 **Analytics** - Property metrics, area intelligence, and comparables
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
   - All free features
   - Advanced analytics
   - Priority support
   - Configurable via `STRIPE_PRICE_PRO` environment variable

3. **Investor** - Premium investor tier ($99/month)
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
```

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

### Frontend (Vercel)
1. Connect GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main

### Backend (Railway)
1. Connect GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push to main

### Database (Supabase)
1. Run `supabase/schema.sql` in SQL Editor
2. Configure RLS policies
3. Set up backups and monitoring

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
