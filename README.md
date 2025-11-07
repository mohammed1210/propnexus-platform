# PropNexus Platform

![Frontend CI](https://github.com/mohammed1210/propnexus-platform/actions/workflows/frontend-ci.yml/badge.svg)
![Backend CI](https://github.com/mohammed1210/propnexus-platform/actions/workflows/backend-ci.yml/badge.svg)

PropNexus is a comprehensive real estate platform for property investment analysis, featuring AI-powered insights, property listings, and subscription-based access.

## Features

- 🏠 **Property Listings** - Browse and search properties from multiple sources
- 🤖 **AI Analysis** - Investment summaries and exit strategies powered by GPT-4
- 💬 **AI Chatbot** - Interactive GPT-powered assistant for real-time investment advice (Sprint 11)
- 🎯 **AI Deal Scoring** - Automated investment scoring with detailed breakdown (Sprint 11)
- 🏘️ **Area Intelligence** - Crime rates, schools, transport links, and market data (Sprint 11)
- 📊 **Comparable Sales** - Recent sales and rental data for price validation (Sprint 11)
- 💰 **Deal Tracking** - Save and manage potential investment opportunities
- 📊 **Analytics** - Property metrics, area intelligence, and comparables
- 🔐 **Authentication** - Secure user accounts with Supabase Auth
- 💳 **Subscriptions** - Stripe-powered Pro and Investor tier plans
- 👨‍💼 **Admin Dashboard** - Subscriber metrics and MRR tracking

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

# Sprint 11: Feature Flags (toggle AI features on/off)
NEXT_PUBLIC_FEATURE_AI_CHATBOT=true
NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE=true
NEXT_PUBLIC_FEATURE_AREA_INTEL=true
NEXT_PUBLIC_FEATURE_COMPS=true
```

### Backend Environment Variables

Required for development and production:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# API Keys (Sprint 11: OpenAI required for GPT features)
OPENAI_API_KEY=sk-xxx
RESEND_API_KEY=re_xxx

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# CORS (Sprint 11: Added Vercel preview domains)
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.vercel.app,https://*.vercel.app

# Sprint 11: Caching (optional, defaults to 1800 seconds = 30 minutes)
CACHE_TTL_SECONDS=1800
```

See [docs/FEATURE_FLAGS.md](docs/FEATURE_FLAGS.md) for detailed feature flag documentation.

## Stripe Configuration

### Price IDs and Plan Mapping

Set up subscription tiers in Stripe Dashboard and map them to plan names:

**Environment Variables (Backend `.env`):**
```env
STRIPE_PRICE_PRO=price_xxx       # Maps to "pro" plan
STRIPE_PRICE_INVESTOR=price_yyy  # Maps to "investor" plan
STRIPE_PRICE_ENTERPRISE=price_zzz # Maps to "enterprise" plan
```

**Plans:**
- **Free Plan**: Default for all users (no Stripe price_id)
- **Pro Plan**: Monthly subscription for basic premium features
- **Investor Plan**: Monthly subscription for advanced investment tools
- **Enterprise Plan**: Custom pricing for teams/organizations

**How it works:**
1. User completes Stripe checkout
2. Webhook receives `checkout.session.completed` event
3. Backend retrieves subscription and extracts `price_id`
4. `price_id` is mapped to plan name using environment variables
5. User record in database is updated with: `plan`, `plan_status`, `current_period_end`
6. Frontend queries `/users/plan?email=...` to display current tier

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

- [Feature Flags Guide](docs/FEATURE_FLAGS.md) - Sprint 11 feature flag configuration
- [Changelog](docs/CHANGELOG.md) - Version history and release notes
- [Sprint 10 Completion Report](docs/sprint-10-completion.md) - Latest sprint details
- [Database Setup](supabase/README.md) - Database schema and RLS policies
- [Development Guide](docs/README-DEV.md) - Development workflow
- [Roadmap](docs/po-roadmap.md) - Product roadmap
- [Contributing](docs/CONTRIBUTING.md) - Contribution guidelines

## Sprint 11 Features

### AI Chatbot
Interactive GPT-powered assistant available on property detail pages. Features:
- Floating bottom-right button for easy access
- Context-aware responses using property data
- Conversation history persistence (localStorage)
- Fallback to rule-based responses when OpenAI unavailable
- Toggle with `NEXT_PUBLIC_FEATURE_AI_CHATBOT=true`

**Backend:** `POST /gpt/chat`  
**Frontend:** `components/property_details/AIChatbot.tsx`

### AI Deal Score
Automated investment scoring with detailed breakdown:
- Overall score (0-100) based on 6 key metrics
- Category breakdown with progress bars:
  - Rental Yield (20 pts)
  - ROI Potential (20 pts)
  - Price-to-Rent (15 pts)
  - Area Demand (15 pts)
  - Safety Index (15 pts)
  - Schools Access (15 pts)
- "Why this score?" GPT explanation
- Toggle with `NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE=true`

**Backend:** `POST /gpt/score`, `POST /gpt/score/explain`  
**Frontend:** `components/property_details/DealScore.tsx`

### Area Intelligence
Comprehensive area metrics with 24-hour caching:
- Population, avg price, avg rent
- Crime index (0-100) with visualization
- Schools rating (0-5.0)
- Transport links
- Cache/Live data source indicator
- Toggle with `NEXT_PUBLIC_FEATURE_AREA_INTEL=true`

**Backend:** `GET /area-intel/{key}`  
**Frontend:** `components/property_details/AreaIntelPanel.tsx`

### Comparable Sales
Recent sales and rental listings in the area:
- Average sale price and rent calculations
- Top 3 recent sales and rentals
- Property details: address, price, date, type, distance
- 24-hour caching for performance
- Toggle with `NEXT_PUBLIC_FEATURE_COMPS=true`

**Backend:** `GET /comps/{postcode}`  
**Frontend:** `components/property_details/CompsPanel.tsx`

### Local Setup for Sprint 11

1. Set backend API key:
```bash
cd backend
echo "OPENAI_API_KEY=sk-your-key-here" >> .env
```

2. Enable frontend features:
```bash
cd frontend
cat >> .env.local <<EOF
NEXT_PUBLIC_FEATURE_AI_CHATBOT=true
NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE=true
NEXT_PUBLIC_FEATURE_AREA_INTEL=true
NEXT_PUBLIC_FEATURE_COMPS=true
NEXT_PUBLIC_API_BASE=http://localhost:8000
EOF
```

3. Run both servers:
```bash
# Terminal 1: Backend
cd backend && uvicorn main:app --reload

# Terminal 2: Frontend
cd frontend && npm run dev
```

4. Visit http://localhost:3000 and navigate to any property detail page to see the new features.

### API Route Documentation

#### POST /gpt/chat
```bash
curl -X POST http://localhost:8000/gpt/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Is this a good investment?"}],
    "context": {
      "property_id": "123",
      "summary": "2-bed flat in Manchester",
      "area_key": "M1 1AA",
      "postcode": "M1 1AA"
    }
  }'
```

Response:
```json
{
  "ok": true,
  "reply": "Based on the property details...",
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 75
  }
}
```

#### POST /gpt/score
```bash
curl -X POST http://localhost:8000/gpt/score \
  -H "Content-Type: application/json" \
  -d '{
    "price": 200000,
    "yield_percent": 6.5,
    "roi_percent": 12,
    "rent": 1100,
    "crime_index": 30,
    "schools_rating": 4.2
  }'
```

Response:
```json
{
  "ok": true,
  "score": 78.5,
  "categories": {
    "yield": 20.0,
    "roi": 20.0,
    "price_to_rent": 12.3,
    "area_demand": 11.0,
    "crime_index_inverse": 10.5,
    "schools_access": 12.6
  },
  "version": "v1.0"
}
```

#### POST /gpt/score/explain
```bash
curl -X POST http://localhost:8000/gpt/score/explain \
  -H "Content-Type: application/json" \
  -d '{
    "score": 78,
    "property": {
      "price": 200000,
      "location": "Manchester M1",
      "bedrooms": 2,
      "yield_percent": 6.5,
      "roi_percent": 12
    }
  }'
```

Response:
```json
{
  "ok": true,
  "explanation": "This property scores well due to strong yield and ROI...",
  "bullets": [
    "Excellent rental yield of 6.5% indicates strong cash flow",
    "ROI of 12% suggests good capital appreciation potential",
    "..."
  ]
}
```

#### GET /area-intel/{key}
```bash
curl http://localhost:8000/area-intel/M1%201AA
```

Response:
```json
{
  "key": "M1 1AA",
  "population": 45000,
  "avg_price": 220000,
  "avg_rent": 1200,
  "rental_yield_percent": 6.5,
  "crime_index": 35,
  "schools_rating": 4.1,
  "transport_links": ["Piccadilly Station", "Metrolink"],
  "notes": "City center location",
  "source": "cache",
  "cached_at": "2025-11-06T18:00:00Z"
}
```

#### GET /comps/{postcode}
```bash
curl http://localhost:8000/comps/M1%201AA
```

Response:
```json
{
  "postcode": "M1 1AA",
  "sales": [
    {
      "address": "Flat 5, City Tower",
      "price": 195000,
      "date": "2024-10-15",
      "type": "Flat",
      "distance_km": 0.3
    }
  ],
  "rents": [
    {
      "address": "Apt 12, Urban Heights",
      "price": 1150,
      "date": "2024-11-01",
      "type": "Flat",
      "distance_km": 0.5
    }
  ],
  "source": "provider"
}
```

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

## Sprint 11: AI Features

### AI Chatbot
The platform now includes a floating AI assistant that provides real-time investment advice using GPT-4. Features:
- Persistent conversation history per property (localStorage)
- Context-aware responses using property details
- Support for custom quick prompts
- Dark mode support

**Enable:** Set `NEXT_PUBLIC_FEATURE_AI_CHATBOT=true` in frontend environment.

### AI Deal Scoring
Automated investment scoring system that analyzes properties across 6 key categories:
- **Rental Yield** (0-20 points) - Cash flow potential
- **ROI Potential** (0-20 points) - Return on investment
- **Price-to-Rent Ratio** (0-15 points) - Value assessment
- **Area Demand** (0-15 points) - Market strength
- **Safety Index** (0-15 points) - Crime data inverse
- **Schools Access** (0-15 points) - Educational amenities

Total score: 0-100 with animated visual breakdown.

**Enable:** Set `FEATURE_DEAL_SCORING=true` in backend environment.

### AI Score Explanation
GPT-powered explanation feature that provides:
- Natural language summary of the deal score
- 5-7 key bullet points highlighting factors
- Personalized insights based on property data

### Area Intelligence
Displays comprehensive area data:
- Population and demographics
- Average property prices and rents
- Rental yield percentages
- Crime index with visual indicators
- School ratings (0-5 scale)
- Transport links (rail, bus, etc.)

**Enable:** Set `FEATURE_AREA_INTEL_PANEL=true` in backend environment.

### Comparable Sales (Comps)
Shows recent transactions near the property:
- Recent sales with prices and dates
- Rental listings with monthly rates
- Property types and distances
- Average prices across comparables
- Cache indicators (live vs cached data)

**Enable:** Set `FEATURE_COMPS_PANEL=true` in backend environment.

### API Endpoints

**Chat:**
```
POST /gpt/chat
Body: {
  "messages": [{"role": "user", "content": "..."}],
  "context": {"property_id": "...", "summary": "...", ...}
}
```

**Scoring:**
```
POST /gpt/score
Body: { property data with yield_percent, roi_percent, etc. }
```

**Explanation:**
```
POST /gpt/score/explain
Body: { "score": 75, "property": {...} }
```

**Area Intel:**
```
GET /area-intel/{area_key}
```

**Comps:**
```
GET /comps/{postcode}
```

### Testing
All new features are fully tested:
- `backend/tests/test_gpt_chat.py` - AI chat endpoint tests
- `backend/tests/test_scoring.py` - Scoring algorithm tests
- `backend/tests/test_ai_score_zero_values.py` - Zero value handling in scoring
- `backend/tests/test_comps_optional_lists.py` - Comps with missing arrays
- `backend/tests/test_users_plan_investor.py` - Investor plan webhook tests
- Mock OpenAI responses to avoid API costs in CI

Run tests:
```bash
cd backend
pytest tests/ -v
```

## Troubleshooting (Sprint 11)

### Logged-in Users See No Listings

**Symptom:** After signing in, property listings page shows empty results. Signing out shows properties again.

**Cause:** Row-Level Security (RLS) policies on the `properties` table only allow anonymous access but deny authenticated users.

**Fix:** Applied in migration `20251106_fix_rls_properties.sql`:
```sql
-- Allow both authenticated and anonymous users to read published properties
CREATE POLICY "properties_read_auth" ON public.properties
  FOR SELECT TO authenticated
  USING (published = true);

CREATE POLICY "properties_read_anon" ON public.properties
  FOR SELECT TO anon
  USING (published = true);
```

### Saved Deals Not Rendering

**Symptom:** User saves deals, data appears in database, but `/saved-deals` page shows nothing.

**Cause:** Missing or incorrect RLS policies on `saved_deals` table prevent users from reading their own rows.

**Fix:** Applied in migration `20251106_saved_deals_rls.sql`:
```sql
-- Allow users to read/write their own saved deals
CREATE POLICY "saved_deals_rw_owner" ON public.saved_deals
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "saved_deals_insert_owner" ON public.saved_deals
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_deals_delete_owner" ON public.saved_deals
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
```

### Plan Shows "Free" After Upgrade

**Symptom:** User purchases Pro or Investor plan, but app still shows "Free" tier.

**Cause:** Stripe webhook not mapping `price_id` to plan name correctly.

**Fix:** 
1. Updated `backend/routes/stripe_webhook.py` to map Stripe price IDs to plan names:
   - Set environment variables: `STRIPE_PRICE_PRO`, `STRIPE_PRICE_INVESTOR`, `STRIPE_PRICE_ENTERPRISE`
   - Webhook now upserts `plan`, `plan_status`, and `current_period_end` fields
2. Database migration adds `investor` to plan constraint (`20251106_add_investor_to_plan.sql`)
3. Frontend should revalidate `/users/plan` after returning from Stripe checkout

### Feature Flags Not Working

**Symptom:** Feature flag environment variables set, but features still showing/hidden.

**Cause:** 
- Frontend: Not importing/using the flags helper (`lib/flags.ts`)
- Backend: Backend feature flags are different (not `NEXT_PUBLIC_*` prefixed)

**Fix:**
1. Frontend uses `frontend/lib/flags.ts` helper:
   ```typescript
   import { FF } from '@/lib/flags';
   {FF.DEAL_SCORE && <DealScoreCard property={property} />}
   ```
2. Set variables in `frontend/.env.local`:
   ```bash
   NEXT_PUBLIC_FEATURE_AI_CHATBOT=true
   NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE=true
   NEXT_PUBLIC_FEATURE_AREA_INTEL=true
   NEXT_PUBLIC_FEATURE_COMPS=true
   ```
3. Remember to rebuild frontend after changing environment variables

### AI Score Shows Incorrect Values for Safe Areas

**Symptom:** Properties in very safe areas (crime_index=0) receive lower safety scores than expected.

**Cause:** Backend treats `0` as falsy and replaces with default value `50`.

**Fix:** Updated `backend/routes/gpt_routes.py` to explicitly check for `None`:
```python
crime = data.get("crime_index")
crime = 50 if crime is None else float(crime)  # Preserves 0

schools = data.get("schools_rating")
schools = 3.0 if schools is None else float(schools)  # Preserves 0
```

### Comps Panel Crashes with Missing Data

**Symptom:** Comparable sales panel shows error when provider returns incomplete data.

**Cause:** Frontend assumes `sales` and `rents` arrays always exist.

**Fix:** Updated `frontend/components/property_details/CompsPanel.tsx` to guard against missing arrays:
```typescript
const sales = Array.isArray(data?.sales) ? data.sales : [];
const rents = Array.isArray(data?.rents) ? data.rents : [];
```

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for contribution guidelines.

## License

Copyright © 2025 PropNexus. All rights reserved.

## Support

For issues or questions:
- Open an issue on GitHub
- Check documentation in `/docs`
- Review environment variable setup
