import { useState, useEffect, useRef } from 'react';

export type SearchHit = Record<string, unknown>;

type SearchMeta = {
  broadened?: boolean;
  changes?: Record<string, string>;
};

export function useStreamedSearch(body: Record<string, unknown> | null) {
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [meta, setMeta] = useState<SearchMeta>({});
  const [loading, setLoading] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!body) return;
    abort.current?.abort();
    abort.current = new AbortController();

    (async () => {
      setHits([]);
      setMeta({});
      setLoading(true);

      const applyEnvelope = (obj: Record<string, unknown>) => {
        const results = obj.results;
        const items = obj.items;
        const envelopeHits = Array.isArray(results)
          ? (results as SearchHit[])
          : Array.isArray(items)
            ? (items as SearchHit[])
            : null;

        if (!envelopeHits) return false;

        setHits(envelopeHits);
        setMeta({
          broadened: Boolean(obj.broadened),
          changes:
            obj.changes && typeof obj.changes === 'object'
              ? (obj.changes as Record<string, string>)
              : {},
        });
        return true;
      };

      try {
        const res = await fetch('/api/search?stream=1', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: abort.current!.signal,
        });

        if (!res.ok || !res.body) {
          return;
        }

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const l of lines) {
            if (!l.trim()) continue;
            try {
              const obj = JSON.parse(l) as Record<string, unknown>;
              if (applyEnvelope(obj)) return;
              setHits((h) => [...h, obj]);
            } catch {
              // ignore malformed stream lines
            }
          }
        }

        // Handle non-NDJSON responses (e.g. proxy returns a single JSON payload).
        if (buf.trim()) {
          try {
            const obj = JSON.parse(buf) as Record<string, unknown>;
            if (applyEnvelope(obj)) return;
            setHits([obj]);
          } catch {
            // ignore trailing junk
          }
        }
      } finally {
        setLoading(false);
      }
    })().catch(console.error);

    return () => abort.current?.abort();
  }, [body]);

  return { hits, loading, meta };
}
