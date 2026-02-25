# PropNexus AI API Contract

## Canonical API surface (recommended)
**`/gpt/*` is the canonical AI API surface**.

Use `/gpt/*` for:
- Chat-style interactions
- Scoring + explainability
- Future AI features

## Compatibility surface (legacy)
**`/ai/*` remains supported for backwards compatibility** with existing frontend calls.

`/ai/*` is NOT the long-term public contract and may become a thin wrapper over `/gpt/*`.

## Current endpoints

### Canonical (`/gpt/*`)
- `GET /gpt/health`
- `POST /gpt/chat`
- `POST /gpt/score`
- `POST /gpt/score/explain`

### Compatibility (`/ai/*`)
- `POST /ai/summary`
- `POST /ai/strategies`
- `POST /ai/tradesmen/recommend`

## Environment requirements
- Endpoints that call OpenAI require `OPENAI_API_KEY`.
- When missing, endpoints should fail safely (503 preferred) with a structured response.
