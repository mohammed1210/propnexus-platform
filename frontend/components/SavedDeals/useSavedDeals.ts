'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchWithRetry } from '@/lib/api';
import type { SavedDeal } from './types';

export type UseSavedDealsState = {
  deals: SavedDeal[];
  loading: boolean;
  error: string | null;
  authRequired: boolean;
  selectedPropertyIds: string[];
  maxHint: string | null;
  refresh: () => Promise<void>;
  toggleSelect: (propertyId: string | null) => void;
  clearSelection: () => void;
  removeSaved: (savedDealId: string) => Promise<void>;
};

function isAuthStatus(status: number): boolean {
  return status === 401 || status === 403;
}

export function useSavedDeals(): UseSavedDealsState {
  const [deals, setDeals] = useState<SavedDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [maxHint, setMaxHint] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAuthRequired(false);

    try {
      const res = await fetchWithRetry(`/api/saved-deals`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        if (isAuthStatus(res.status)) {
          setAuthRequired(true);
          setDeals([]);
          return;
        }
        const msg = await res.text().catch(() => '');
        throw new Error(msg || `Failed to load saved deals (${res.status})`);
      }

      const json = await res.json().catch(() => null);
      const items = Array.isArray(json) ? json : (json as any)?.data;
      setDeals((Array.isArray(items) ? items : []) as SavedDeal[]);
    } catch (e: any) {
      setDeals([]);
      setError(e?.message ?? 'Failed to load saved deals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleSelect = useCallback((propertyId: string | null) => {
    if (!propertyId) return;

    setSelectedPropertyIds((prev) => {
      const exists = prev.includes(propertyId);
      if (exists) return prev.filter((x) => x !== propertyId);
      if (prev.length >= 4) {
        setMaxHint('Compare up to 4');
        window.setTimeout(() => setMaxHint(null), 2200);
        return prev;
      }
      return [...prev, propertyId];
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPropertyIds([]);
  }, []);

  const removeSaved = useCallback(
    async (savedDealId: string) => {
      const prev = deals;
      setDeals((d) => d.filter((x) => x.id !== savedDealId));

      // Also clear selection if that property was selected.
      const removed = prev.find((d) => d.id === savedDealId);
      if (removed?.property_id) {
        setSelectedPropertyIds((s) => s.filter((pid) => pid !== removed.property_id));
      }

      try {
        const res = await fetchWithRetry(
          `/api/saved-deals/${encodeURIComponent(savedDealId)}`,
          { method: 'DELETE' },
        );
        if (!res.ok) {
          if (isAuthStatus(res.status)) {
            setAuthRequired(true);
          }
          throw new Error(`Remove failed (${res.status})`);
        }
      } catch (e) {
        setDeals(prev);
        throw e;
      }
    },
    [deals],
  );

  return useMemo(
    () => ({
      deals,
      loading,
      error,
      authRequired,
      selectedPropertyIds,
      maxHint,
      refresh,
      toggleSelect,
      clearSelection,
      removeSaved,
    }),
    [
      deals,
      loading,
      error,
      authRequired,
      selectedPropertyIds,
      maxHint,
      refresh,
      toggleSelect,
      clearSelection,
      removeSaved,
    ],
  );
}
