# Authentication API Documentation

## User Plan Endpoint

The `/users/plan` endpoint provides information about a user's subscription plan.

### Endpoint

```
GET /users/plan
```

### Authentication Methods

The endpoint supports two authentication methods for backward compatibility:

#### 1. Token-based Authentication (Recommended)

Use the Supabase JWT token from the user's session:

```bash
GET /users/plan
Authorization: Bearer <supabase_jwt_token>
```

**Frontend Usage:**

```typescript
import { getSupabase } from '@/lib/supabaseClient';

const sb = getSupabase();
const { data: sessionData } = await sb.auth.getSession();
const token = sessionData?.session?.access_token;

const response = await fetch(`${backendUrl}/users/plan`, {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
```

**Benefits:**
- More secure (no email in URL)
- Standard OAuth 2.0 pattern
- Token includes user identity and permissions
- Works with Supabase's built-in auth

#### 2. Email Query Parameter (Legacy)

Provide the user's email as a query parameter:

```bash
GET /users/plan?email=user@example.com
```

**Note:** This method is maintained for backward compatibility but token-based authentication is recommended for new implementations.

### Response

Both methods return the same response format:

```json
{
  "plan": "pro",
  "stripe_customer_id": "cus_123abc"
}
```

**Fields:**
- `plan`: User's subscription tier (`free`, `pro`, or `investor`)
- `stripe_customer_id`: Stripe customer ID (null if no subscription)

### Error Responses

**401 Unauthorized** - Missing or invalid authentication:
```json
{
  "detail": "Invalid or expired token"
}
```

**401 Unauthorized** - No authentication provided:
```json
{
  "detail": "Missing authentication. Provide either email query parameter or Authorization header."
}
```

**500 Internal Server Error** - Server configuration issue:
```json
{
  "detail": "Supabase not configured on server"
}
```

### Backend Configuration

Add the following to `backend/.env`:

```bash
# Supabase configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# JWT secret for verifying tokens (found in Supabase Dashboard > Settings > API)
SUPABASE_JWT_SECRET=your-jwt-secret
```

**Note:** The JWT secret can be found in your Supabase project settings under API → JWT Secret. It's used to verify the signature of JWT tokens.

### Testing

#### Test with curl (Token-based)

```bash
# Get a token from Supabase
TOKEN="your-supabase-jwt-token"

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/users/plan
```

#### Test with curl (Email-based)

```bash
curl "http://localhost:8000/users/plan?email=user@example.com"
```

### Migration Guide

If you're currently using the email-based method:

**Before (Legacy):**
```typescript
const { data: userData } = await sb.auth.getUser();
const email = userData?.user?.email;

const response = await fetch(
  `${backendUrl}/users/plan?email=${encodeURIComponent(email)}`
);
```

**After (Recommended):**
```typescript
const { data: sessionData } = await sb.auth.getSession();
const token = sessionData?.session?.access_token;

const response = await fetch(
  `${backendUrl}/users/plan`,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  }
);
```

### Security Considerations

1. **Token-based authentication is more secure** because:
   - Tokens are short-lived and expire automatically
   - Tokens are cryptographically signed
   - Email addresses are not exposed in URLs (which may be logged)

2. **JWT Secret Protection:**
   - Never commit the JWT secret to version control
   - Store it securely in environment variables
   - Use different secrets for development and production

3. **HTTPS in Production:**
   - Always use HTTPS in production to prevent token interception
   - Tokens in URLs (email method) are especially vulnerable without HTTPS

### Related Documentation

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Feature Flags](./FEATURE_FLAGS.md)
- [Sprint 10 Completion](./sprint-10-completion.md)
