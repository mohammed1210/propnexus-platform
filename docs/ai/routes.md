#### `docs/ai/routes.md`
```md
# AI Routes

The API exposes two endpoints under `/ai`:

## `POST /ai/summary`

Generate a concise investment summary and bullet points for a property.

**Request body** (`application/json`):

```json
{
  "title": "2-bed flat in Uxbridge",
  "price": 300000,
  "location": "UB8",
  "yield": 5.8,
  "roi": 12.0,
  "description": "Leasehold, near tube"
}
