# Changelog

All notable changes to the PropNexus Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [11.0.0] - 2025-11-06

### Added - Sprint 11: AI-Powered Property Analysis

#### Backend API Endpoints

**AI Chat**
- `POST /gpt/chat` - Interactive AI assistant for property investment queries
  - Accepts conversation history with context (property ID, location, budget)
  - Returns GPT-powered responses with token usage tracking
  - Rate-limited and requires `OPENAI_API_KEY`
  - Fallback to rule-based responses when API unavailable

**AI Deal Scoring**
- `POST /gpt/score` - Deterministic investment scoring algorithm
  - Analyzes 6 key metrics: yield, ROI, price-to-rent, area demand, safety, schools
  - Returns overall score (0-100) and category breakdown
  - No GPT dependency - fast, deterministic results
  - Supports partial data with sensible defaults

- `POST /gpt/score/explain` - GPT-powered score explanation
  - Generates natural language summary of deal score
  - Provides 5-7 bullet points highlighting key factors
  - Requires `OPENAI_API_KEY`

**Area Intelligence**
- `GET /area-intel/{key}` - Comprehensive area data with caching
  - Returns population, avg price, avg rent, crime index, schools rating
  - 24-hour TTL cache in Supabase (configurable via `CACHE_TTL_SECONDS`)
  - Returns `source: "cache"` or `source: "provider"` indicator
  - Automatic cache refresh when stale

**Comparable Sales**
- `GET /comps/{postcode}` - Recent sales and rental listings
  - Returns sales and rental comparables within radius
  - Includes price, date, address, type, distance
  - 24-hour TTL cache in Supabase
  - Returns cache source indicator

#### Frontend Components

**AIChatbot** (`components/property_details/AIChatbot.tsx`)
- Floating bottom-right button with modal interface
- Persistent conversation history (localStorage, last 60 messages)
- Quick prompt buttons for common questions
- Automatic context injection (property ID, location, price, yield)
- Graceful fallback when backend unavailable
- Controlled by `NEXT_PUBLIC_FEATURE_AI_CHATBOT` flag

**DealScore** (`components/property_details/DealScore.tsx`)
- Large numeric score display (0-100) with color coding
- Category breakdown with animated progress bars
- "Why this score?" button for detailed GPT explanation
- Loading skeletons and error states
- Controlled by `NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE` flag

**AreaIntelPanel** (`components/property_details/AreaIntelPanel.tsx`)
- KPI grid showing population, prices, yield
- Crime index and schools rating with progress bars
- Transport links tags
- Cache/Live data source indicator
- Controlled by `NEXT_PUBLIC_FEATURE_AREA_INTEL` flag

**CompsPanel** (`components/property_details/CompsPanel.tsx`)
- Summary stats: avg sale price, avg rent
- Recent sales and rentals lists (top 3 each)
- Property details: address, price, date, type, distance
- Cache/Live data source indicator
- Controlled by `NEXT_PUBLIC_FEATURE_COMPS` flag

#### Property Detail Page Integration

Updated `app/property/[id]/page.tsx`:
- Integrated all four new components conditionally via feature flags
- Maintained existing sections (mortgage calc, stamp duty, notes)
- Two-column responsive layout (lg:grid-cols-2)
- Preserved backward compatibility with existing features

#### API Library

Updated `frontend/lib/api.ts`:
- Added `postAIChat()` - chat endpoint wrapper
- Added `postAIScore()` - scoring endpoint wrapper  
- Added `postAIScoreExplain()` - explanation endpoint wrapper
- Added `getAreaIntel()` - area intelligence getter
- Added `getComps()` - comparables getter
- Consistent error handling and TypeScript types

#### Testing

**Backend Tests**
- `tests/test_gpt_chat.py` - AI chat endpoint validation
  - Happy path with context
  - Missing/empty messages validation
  - Without context handling
- `tests/test_scoring.py` - AI scoring tests
  - Basic scoring with minimal data
  - Full data scoring with all metrics
  - Category sum validation
  - Explanation generation
- `tests/test_cache.py` - Enhanced cache tests
  - Source toggle verification (provider → cache)
  - TTL expiry and refresh
  - Both comps and area intel routes

All tests passing: 17/18 (1 skipped - health check in CI)

#### Documentation

- **docs/FEATURE_FLAGS.md** - Complete feature flag reference
  - Usage instructions for each flag
  - Deployment configuration guide
  - Troubleshooting section
  - Rollout strategy recommendations

- **README.md** - Updated with Sprint 11 features
  - Added all four features to features list
  - Installation and setup instructions
  - Environment variables documentation

- **Environment Templates**
  - Updated `backend/.env.example` with OPENAI_API_KEY, CACHE_TTL_SECONDS
  - Updated `backend/.env.template` with all Sprint 11 variables
  - Updated `frontend/.env.example` with feature flags
  - Updated root `.env.example` with documentation

#### Configuration

**Environment Variables**
- `OPENAI_API_KEY` (backend) - Required for GPT features
- `CACHE_TTL_SECONDS` (backend) - Cache duration in seconds (default: 1800)
- `NEXT_PUBLIC_FEATURE_AI_CHATBOT` (frontend) - Toggle chatbot
- `NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE` (frontend) - Toggle deal scoring
- `NEXT_PUBLIC_FEATURE_AREA_INTEL` (frontend) - Toggle area intelligence
- `NEXT_PUBLIC_FEATURE_COMPS` (frontend) - Toggle comparables
- `NEXT_PUBLIC_API_BASE` (frontend) - Backend API URL

**CORS Updates**
- Added Vercel preview domains to allowed origins
- Pattern: `https://*.vercel.app`
- Enables testing on preview deployments

### Changed

**Backend**
- Enhanced area intelligence caching with TTL configuration
- Improved comps route to return consistent cache source indicators
- Stripe webhook now returns `{ok: true}` JSON response (was implicit 200)

**Frontend**
- Refactored AIChatbot to use centralized API helper
- Enhanced property detail page layout for better mobile responsiveness
- Improved loading states with skeleton screens

### Technical Details

**Caching Strategy**
- In-memory TTL cache for area intelligence and comparables
- Supabase tables: `area_intel_cache`, `comps_cache`
- Automatic stale data refresh on next request
- Cache-Control headers for client-side caching

**Scoring Algorithm**
- Yield: 0-20 points (5%+ yield = full marks)
- ROI: 0-20 points (10%+ ROI = full marks)
- Price-to-Rent: 0-15 points (ratio < 15 = full marks)
- Area Demand: 0-15 points (based on rental prices)
- Safety: 0-15 points (inverse crime index)
- Schools: 0-15 points (0-5 rating scaled)
- **Total: 100 points maximum**

**Dependencies**
- No new frontend dependencies
- No new backend dependencies
- Uses existing OpenAI SDK

### Security

- API keys never exposed to client (server-side only)
- Rate limiting on AI endpoints
- Input validation on all endpoints
- Cache prevents excessive API calls
- Feature flags allow gradual rollout

---

## [10.0.0] - Previous Release

See [SPRINT-10-SUMMARY.md](../SPRINT-10-SUMMARY.md) for Sprint 10 details.

---

## Future Releases

### Planned Features
- Real-time area intelligence data providers
- Enhanced comparable sales with ML-powered filtering
- Multi-language support for AI chatbot
- Advanced scoring models with historical data
- Export functionality for deal scores and reports
