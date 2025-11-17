# Tradesmen Connector Module - Documentation

## Overview

The Tradesmen Connector Module is a feature that helps property investors discover and contact qualified tradespeople (builders, electricians, plumbers, surveyors, roofers) near properties they're viewing on PropNexus.

## Features

### 1. Location-Based Search
- Find tradespeople within a configurable radius (default 20km) of any property
- Uses Haversine formula for accurate distance calculations
- Displays distance from property in kilometers

### 2. Trade Type Filtering
- Filter tradespeople by specialty:
  - Builders
  - Plumbers
  - Electricians
  - Roofers
  - Surveyors

### 3. Contact System
- Direct contact modal for sending messages to tradespeople
- Tracks all leads in database
- Email notifications (ready for integration)

### 4. Rating System (Optional)
- User reviews and ratings for tradespeople
- Automatic average rating calculation via database triggers
- Display star ratings on tradesman cards

### 5. AI Recommendations (Optional)
- AI-powered renovation cost estimates
- Common project suggestions based on property type

## Database Schema

### Tables Created

#### `tradesmen`
Primary directory of tradespeople with location and contact information.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| full_name | text | Tradesperson/company name |
| trade_type | text | Type of trade (builder, plumber, etc.) |
| email | text | Email address |
| phone | text | Phone number |
| website | text | Website URL |
| rating | numeric | Average rating (0-5) |
| latitude | numeric | Location latitude |
| longitude | numeric | Location longitude |
| service_radius_km | int | Service area radius in km |
| created_at | timestamptz | Record creation timestamp |

**Indexes:**
- `idx_tradesmen_location` - On (latitude, longitude) for location queries
- `idx_tradesmen_trade_type` - On trade_type for filtering
- `idx_tradesmen_rating` - On rating DESC for sorting

#### `tradesmen_reviews`
User reviews and ratings for tradespeople.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tradesman_id | uuid | Foreign key to tradesmen |
| user_id | uuid | User who left review |
| rating | int | Rating (1-5 stars) |
| review | text | Review text |
| created_at | timestamptz | Review timestamp |

#### `tradesmen_leads`
Tracks contact attempts from investors to tradespeople.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| tradesman_id | uuid | Foreign key to tradesmen |
| property_id | uuid | Related property (optional) |
| user_email | text | Investor email |
| message | text | Message content |
| status | text | Lead status (sent, read, replied, archived) |
| created_at | timestamptz | Lead creation timestamp |
| updated_at | timestamptz | Last update timestamp |

### Database Triggers

- `trigger_update_tradesman_rating` - Automatically recalculates average rating when reviews are added/updated/deleted

## API Endpoints

### GET `/tradesmen/nearby`

Find tradespeople near a location.

**Query Parameters:**
- `lat` (required): Latitude
- `lng` (required): Longitude
- `trade_type` (optional): Filter by trade type
- `radius_km` (optional): Search radius in km (default: 20)

**Response:**
```json
[
  {
    "id": "uuid",
    "full_name": "John Smith Construction",
    "trade_type": "builder",
    "email": "john@example.com",
    "phone": "020 7123 4567",
    "website": "www.example.com",
    "rating": 4.8,
    "distance_km": 2.3,
    "service_radius_km": 25
  }
]
```

**Example:**
```bash
GET /tradesmen/nearby?lat=51.5074&lng=-0.1278&trade_type=builder&radius_km=10
```

### POST `/tradesmen/contact`

Send a contact message to a tradesman.

**Request Body:**
```json
{
  "tradesman_id": "uuid",
  "property_id": "uuid (optional)",
  "user_email": "investor@example.com",
  "message": "I'm interested in discussing a renovation project..."
}
```

**Response:**
```json
{
  "success": true,
  "lead_id": "uuid",
  "message": "Contact request sent successfully"
}
```

**Validation:**
- `message` must be at least 10 characters
- `user_email` must be valid email format
- `tradesman_id` must exist

### POST `/ai/tradesmen/recommend` (Optional)

Get AI-powered renovation recommendations.

**Request Body:**
```json
{
  "property_details": "3-bed semi in need of renovation",
  "location": "London",
  "property_type": "semi-detached",
  "bedrooms": 3,
  "trade_type": "builder"
}
```

**Response:**
```json
{
  "recommendation": "For a 3-bed semi in London, typical renovation projects include...",
  "property_summary": "3-bed semi-detached in London"
}
```

## Frontend Components

### `TradesmenList.tsx`

Main component that fetches and displays tradespeople.

**Props:**
- `propertyLat: number` - Property latitude
- `propertyLng: number` - Property longitude
- `propertyId?: string` - Property ID (optional)
- `tradeType?: string` - Filter by trade type (optional)
- `radius?: number` - Search radius in km (default: 20)
- `userEmail?: string` - Pre-fill email in contact form (optional)

**Features:**
- Loading states with skeleton UI
- Error handling
- Empty state messaging
- Automatic fetch on prop changes

### `TradesmanCard.tsx`

Individual tradesman card component.

**Props:**
- `tradesman: Tradesman` - Tradesman data
- `onContact: (tradesman: Tradesman) => void` - Contact button handler

**Displays:**
- Name and trade type
- Rating with star icon
- Distance from property
- Contact button

### `ContactTradesmanModal.tsx`

Modal form for contacting a tradesman.

**Props:**
- `tradesman: Tradesman | null` - Selected tradesman
- `propertyId?: string` - Property ID (optional)
- `onClose: () => void` - Close handler
- `userEmail?: string` - Pre-filled email (optional)

**Features:**
- Form validation (email format, message min length)
- Loading states during submission
- Success confirmation
- Error handling

## Integration

### Property Detail Page

The tradesmen section is integrated into the property detail page at:
`frontend/app/property/[id]/page.tsx`

**Location:** After "Comparable Sales" section, before "Exit Strategies"

**Conditional Rendering:** Only shows when property has valid coordinates

**Features:**
- Collapsible card with tool icon
- Trade type filter buttons
- Integrated with existing PropNexus theme

## Setup & Deployment

### 1. Database Migration

Run the migration to create tables:

```bash
# Apply migration in Supabase
psql -f supabase/migrations/20251117_create_tradesmen_tables.sql
```

### 2. Seed Data (Optional)

Populate with sample tradespeople:

```bash
# Load seed data
psql -f supabase/seed/tradesmen_seed.sql
```

### 3. Environment Variables

No new environment variables required. Uses existing:
- `NEXT_PUBLIC_BACKEND_URL` or `NEXT_PUBLIC_API_URL` - Backend API URL
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

### 4. Email Integration (Optional)

To enable email notifications when investors contact tradesmen:

1. Configure email service in backend (Resend, Mailgun, etc.)
2. Implement email sending in `backend/routes/tradesmen_routes.py` (marked with TODO)
3. Update `RESEND_API_KEY` or `MAILGUN_API_KEY` in environment

## Testing

### Backend Tests

Run pytest tests:

```bash
cd backend
pytest tests/test_tradesmen_routes.py -v
```

**Tests include:**
- Endpoint validation
- Distance calculation accuracy
- Trade type filtering
- Contact form validation

### Frontend E2E Tests

Run Playwright tests:

```bash
cd frontend
npm run e2e -- tradesmen.spec.ts
```

**Tests include:**
- Tradesmen section visibility
- Trade type filter interaction
- Contact modal functionality

## Performance Considerations

### Distance Calculations
- Haversine formula runs in O(n) where n = number of tradespeople
- For large datasets, consider:
  - PostgreSQL PostGIS extension for native geospatial queries
  - Bounding box pre-filter before Haversine calculations
  - Spatial indexes

### Caching
- Consider caching tradesman queries by location
- Cache duration: 5-10 minutes for nearby searches
- Invalidate cache on tradesman updates

### Pagination
- Current implementation returns all matches
- For production with large datasets:
  - Add pagination to `/tradesmen/nearby` endpoint
  - Implement infinite scroll or "Load More" in frontend

## Future Enhancements

### Potential Features
1. **User Reviews** - Allow logged-in users to leave reviews
2. **Tradesman Profiles** - Dedicated profile pages with portfolio
3. **Booking System** - Schedule consultations directly
4. **Verification Badges** - Verified/certified tradespeople
5. **Price Estimates** - Indicative pricing for common jobs
6. **Availability Calendar** - Show tradesman availability
7. **Admin Panel** - Manage tradesmen directory
8. **Search History** - Track popular searches

### Technical Improvements
1. **PostGIS Integration** - Use proper geospatial database extension
2. **Real-time Updates** - WebSocket notifications for new messages
3. **Image Upload** - Add photos to tradesman profiles
4. **SEO Optimization** - Create landing pages for trade types
5. **Analytics** - Track contact rates and conversion metrics

## Security Considerations

### Implemented
- ✅ RLS policies on all tables
- ✅ Input validation (email format, message length)
- ✅ SQL injection prevention (parameterized queries)
- ✅ Rate limiting on AI endpoints

### Recommended
- Implement rate limiting on contact endpoint
- Add CAPTCHA to prevent spam
- Email verification for new tradesman registrations
- Audit logging for admin actions

## Support & Maintenance

### Common Issues

**No tradesmen appearing?**
- Check property has valid latitude/longitude
- Verify tradesmen exist in database within search radius
- Check backend API is accessible

**Contact not working?**
- Verify backend is running and accessible
- Check Supabase connection
- Review browser console for errors

**Distance inaccurate?**
- Verify latitude/longitude are correct
- Haversine formula is accurate for distances < 1000km
- For global scale, consider different formulas

### Monitoring

Recommended metrics to track:
- Contact form submission rate
- Average response time to leads
- Most searched trade types
- Geographic distribution of searches
- Conversion rate (searches to contacts)

## License

This feature is part of PropNexus platform and follows the same license terms.

## Contributors

- Implementation: GitHub Copilot
- Code Review: PropNexus Team
