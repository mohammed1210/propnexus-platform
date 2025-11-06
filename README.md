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

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://your-domain.vercel.app
```

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
- Mock OpenAI responses to avoid API costs in CI

Run tests:
```bash
cd backend
pytest tests/ -v
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
