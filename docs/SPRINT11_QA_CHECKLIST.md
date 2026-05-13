# Sprint 11 QA Checklist

## Pre-Deployment Checklist

### Backend Setup
- [ ] Set `OPENAI_API_KEY` in backend environment
- [ ] Set `CACHE_TTL_SECONDS=1800` (or desired value)
- [ ] Verify `ALLOWED_ORIGINS` includes Vercel preview domains
- [ ] Verify Supabase connection works
- [ ] Backend server starts without errors: `uvicorn main:app --reload`

### Frontend Setup
- [ ] All feature flags set in frontend environment:
  - `NEXT_PUBLIC_FEATURE_AI_CHATBOT=true`
  - `NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE=true`
  - `NEXT_PUBLIC_FEATURE_AREA_INTEL=true`
  - `NEXT_PUBLIC_FEATURE_COMPS=true`
- [ ] `NEXT_PUBLIC_API_BASE` points to correct backend URL
- [ ] Frontend builds successfully: `npm run build`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] No ESLint errors: `npx next lint`

### Database
- [ ] `area_intel_cache` table exists in Supabase
- [ ] `comps_cache` table exists in Supabase
- [ ] Tables have correct schema (area_key/postcode, payload, fetched_at)

---

## Backend API Testing

### Test 1: AI Chat Endpoint
```bash
curl -X POST http://localhost:8000/gpt/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Is this a good investment?"}],
    "context": {
      "property_id": "123",
      "summary": "2-bed flat in Manchester",
      "postcode": "M1 1AA"
    }
  }'
```

**Expected:**
- [ ] Returns `{"ok": true, "reply": "...", "usage": {...}}`
- [ ] Reply is relevant and coherent
- [ ] Response time < 5 seconds

**Without OPENAI_API_KEY:**
- [ ] Returns 503 error with clear message

---

### Test 2: AI Score Endpoint
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

**Expected:**
- [ ] Returns `{"ok": true, "score": <number>, "categories": {...}, "version": "v1.0"}`
- [ ] Score is between 0 and 100
- [ ] Categories sum to approximately the total score
- [ ] Works WITHOUT OPENAI_API_KEY (deterministic)

---

### Test 3: AI Score Explanation
```bash
curl -X POST http://localhost:8000/gpt/score/explain \
  -H "Content-Type: application/json" \
  -d '{
    "score": 78,
    "property": {
      "price": 200000,
      "location": "Manchester",
      "yield_percent": 6.5
    }
  }'
```

**Expected:**
- [ ] Returns `{"ok": true, "explanation": "...", "bullets": [...]}`
- [ ] Explanation is coherent
- [ ] 5-7 bullet points returned
- [ ] Response time < 10 seconds

---

### Test 4: Area Intelligence (First Request)
```bash
curl http://localhost:8000/area-intel/M1%201AA
```

**Expected:**
- [ ] Returns area data with `"source": "provider"`
- [ ] Contains: key, population, avg_price, avg_rent, crime_index, schools_rating
- [ ] Data looks reasonable (no zeros or null where inappropriate)

---

### Test 5: Area Intelligence (Cached Request)
```bash
# Immediately after Test 4
curl http://localhost:8000/area-intel/M1%201AA
```

**Expected:**
- [ ] Returns area data with `"source": "cache"`
- [ ] Data is identical to first request
- [ ] Response time is faster than first request

---

### Test 6: Comparables (First Request)
```bash
curl http://localhost:8000/comps/M1%201AA
```

**Expected:**
- [ ] Returns `{"postcode": "M1 1AA", "sales": [...], "rents": [...], "source": "provider"}`
- [ ] Sales and rents arrays contain objects with: address, price, date, type, distance_km
- [ ] Data looks reasonable

---

### Test 7: Comparables (Cached Request)
```bash
# Immediately after Test 6
curl http://localhost:8000/comps/M1%201AA
```

**Expected:**
- [ ] Returns `"source": "cache"`
- [ ] Data is identical to first request
- [ ] Response time is faster

---

### Test 8: Stripe Webhook
```bash
curl -X POST http://localhost:8000/stripe/webhook \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected:**
- [ ] Returns 400 (invalid signature) not 500
- [ ] Does not crash the server

---

## Frontend UI Testing

### Test 9: Property Detail Page Load
1. Navigate to http://localhost:3000
2. Click on any property listing
3. Wait for property detail page to load

**Expected:**
- [ ] Page loads without errors
- [ ] All existing sections render (Investment Summary, Mortgage Calc, etc.)
- [ ] No JavaScript console errors
- [ ] No layout shifts or broken UI

---

### Test 10: AI Deal Score Card

**With NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE=true:**
- [ ] "AI Deal Score" section appears on property page
- [ ] Large numeric score (0-100) displays
- [ ] Score has color coding (green/yellow/red)
- [ ] Category breakdown shows 6 progress bars
- [ ] Each category has label and score value
- [ ] "Why this score?" button appears
- [ ] Loading skeleton appears while fetching

**Click "Why this score?":**
- [ ] Explanation section expands
- [ ] Shows summary paragraph
- [ ] Shows 5-7 bullet points
- [ ] Loading state appears while fetching
- [ ] Click again to hide

**With NEXT_PUBLIC_FEATURE_AI_DEAL_SCORE=false:**
- [ ] Deal Score section does NOT appear

---

### Test 11: Area Intelligence Panel

**With NEXT_PUBLIC_FEATURE_AREA_INTEL=true:**
- [ ] "Area Intelligence" section appears
- [ ] Shows area name/postcode
- [ ] Shows data source indicator (Live/Cached)
- [ ] Grid shows: Population, Avg Price, Avg Rent, Rental Yield
- [ ] Crime Index progress bar displays
- [ ] Schools Rating progress bar displays
- [ ] Transport links tags display (if available)
- [ ] All numbers are formatted properly (commas, currency symbols)

**Refresh page:**
- [ ] Second load shows "Cached" indicator
- [ ] Data is identical

**With NEXT_PUBLIC_FEATURE_AREA_INTEL=false:**
- [ ] Area Intelligence section does NOT appear

---

### Test 12: Comparables Panel

**With NEXT_PUBLIC_FEATURE_COMPS=true:**
- [ ] "Comparable Sales" section appears
- [ ] Shows data source indicator (Live/Cached)
- [ ] Summary stats: Avg Sale Price, Avg Rent
- [ ] "Recent Sales" section lists up to 3 sales
- [ ] Each sale shows: address, price, date, type, distance
- [ ] "Recent Rentals" section lists up to 3 rentals
- [ ] Each rental shows: address, price/mo, date, type, distance
- [ ] "+X more" indicator appears if >3 results

**Refresh page:**
- [ ] Second load shows "Cached" indicator

**With NEXT_PUBLIC_FEATURE_COMPS=false:**
- [ ] Comparables section does NOT appear

---

### Test 13: AI Chatbot

**Default / with NEXT_PUBLIC_FEATURE_AI_CHATBOT=true:**
- [ ] "Ask AI" floating button appears in bottom-right corner across the app
- [ ] Button has blue background and white text

**Click "Ask AI":**
- [ ] Chat modal opens
- [ ] Shows initial greeting message
- [ ] Shows 3 quick prompt buttons
- [ ] Input field and Send button appear
- [ ] X close button in header

**Send message "Is this a good investment?":**
- [ ] User message appears in blue on right
- [ ] "Thinking..." loading indicator appears
- [ ] AI response appears in gray on left
- [ ] Response is relevant to the property
- [ ] Scroll auto-scrolls to bottom

**Click quick prompt button:**
- [ ] Prompt text appears in input
- [ ] Message sends automatically
- [ ] Response received

**Close and reopen chatbot:**
- [ ] Conversation history persists (localStorage)
- [ ] Can continue conversation

**With NEXT_PUBLIC_FEATURE_AI_CHATBOT=false:**
- [ ] Chatbot remains visible and uses the local fallback reply path instead of live GPT

---

### Test 14: Error States

**Backend offline:**
- [ ] Deal Score shows "Score unavailable" not crash
- [ ] Area Intel shows "Area intelligence unavailable" not crash
- [ ] Comps shows "No comparable sales data available" not crash
- [ ] Chatbot falls back to local responses

**Invalid property data:**
- [ ] Components handle missing fields gracefully
- [ ] No "undefined" or "NaN" displayed
- [ ] Sensible defaults shown

---

### Test 15: Responsive Design

**Test on mobile viewport (375px):**
- [ ] Property page layout switches to single column
- [ ] All sections stack vertically
- [ ] Chatbot modal fits on screen
- [ ] Progress bars render correctly
- [ ] Text is readable
- [ ] No horizontal scroll

---

### Test 16: Accessibility

**Keyboard navigation:**
- [ ] Can tab to "Ask AI" button
- [ ] Can tab through chatbot input and buttons
- [ ] Can tab to "Why this score?" button
- [ ] Enter key works in chat input

**Screen reader:**
- [ ] "Ask AI" button has aria-label
- [ ] Chat modal has role="dialog"
- [ ] Input has label (sr-only)
- [ ] Loading states announced

---

## Integration Tests

### Test 17: Full User Flow
1. Visit homepage
2. Search for properties
3. Click on a property
4. View AI Deal Score
5. Click "Why this score?" explanation
6. Scroll to Area Intelligence
7. Scroll to Comparables
8. Open AI Chatbot
9. Ask 3 questions
10. Close chatbot and navigate away
11. Return to same property
12. Reopen chatbot

**Expected:**
- [ ] All features work smoothly
- [ ] No errors in console
- [ ] Chat history persists
- [ ] Cached data loads quickly
- [ ] Page performance is acceptable

---

### Test 18: Cache Expiry
1. Clear Supabase cache tables manually
2. Load property page (should be "Live")
3. Wait for TTL to expire (or set CACHE_TTL_SECONDS=10 for testing)
4. Reload page after expiry

**Expected:**
- [ ] First load: source = "provider"
- [ ] Second load within TTL: source = "cache"
- [ ] Load after TTL expiry: source = "provider" (refreshed)

---

## Performance Benchmarks

### Backend Response Times
- [ ] `/gpt/score` < 100ms (deterministic, no GPT)
- [ ] `/gpt/chat` < 5s (GPT call)
- [ ] `/gpt/score/explain` < 10s (GPT call)
- [ ] `/area-intel/{key}` (cached) < 50ms
- [ ] `/comps/{postcode}` (cached) < 50ms

### Frontend Load Times
- [ ] Property page initial load < 2s
- [ ] Deal Score data fetch < 2s
- [ ] Area Intel data fetch < 2s
- [ ] Comps data fetch < 2s
- [ ] Chatbot response < 6s

---

## Deployment Verification

### Vercel Preview
- [ ] Preview deployment builds successfully
- [ ] All environment variables set correctly
- [ ] Property pages load in preview
- [ ] All 4 features work in preview
- [ ] No console errors in preview

### Backend (Railway/Heroku)
- [ ] Backend deploys successfully
- [ ] Health check passes: `curl https://your-backend.app/health`
- [ ] CORS allows Vercel preview domain
- [ ] Environment variables set
- [ ] Logs show no errors

---

## Final Sign-Off

- [ ] All backend tests pass: `pytest tests/`
- [ ] All frontend tests pass: `npm run test`
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] ESLint passes: `npx next lint`
- [ ] Build succeeds: `npm run build`
- [ ] Documentation is complete and accurate
- [ ] Environment templates are up to date
- [ ] Feature flags are documented
- [ ] API examples are tested and accurate
- [ ] No secrets committed to repository
- [ ] PR description is complete

---

**Tester Name:** ___________________________

**Date:** ___________________________

**Environment:** ___________________________

**Notes:**
