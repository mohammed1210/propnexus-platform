'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { clearSavedDeals, fetchSavedDeals, removeSavedDealByPropertyId } from '@/lib/api/savedDeals';
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
  removeSaved: (propertyId: string) => Promise<void>;
  clearAll: () => Promise<void>;
};

function isAuthStatus(status: number): boolean {
  return status === 401 || status === 403;
}

export function useSavedDeals(): UseSavedDealsState {
  const { userId } = useAuth();
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
      const items = await fetchSavedDeals({ userId: userId ?? null });
      setDeals(items as unknown as SavedDeal[]);
    } catch (e: any) {
      const status = (e as any)?.status;
      if (typeof status === 'number' && isAuthStatus(status)) {
        setAuthRequired(true);
        setDeals([]);
        return;
      }
      setDeals([]);
      setError(e?.message ?? 'Failed to load saved deals.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

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
    async (propertyId: string) => {
      const prev = deals;
      setDeals((d) => d.filter((x) => String(x.property_id ?? '') !== propertyId));
      setSelectedPropertyIds((s) => s.filter((pid) => pid !== propertyId));

      try {
        await removeSavedDealByPropertyId({ propertyId, userId: userId ?? null });
      } catch (e: any) {
        const status = (e as any)?.status;
        if (typeof status === 'number' && isAuthStatus(status)) {
          setAuthRequired(true);
        }
        setDeals(prev);
        throw e;
      }
    },
    [deals, userId],
  );

  const clearAll = useCallback(async () => {
    const prev = deals;
    setDeals([]);
    setSelectedPropertyIds([]);

    try {
      await clearSavedDeals({ userId: userId ?? null });
    } catch (e: any) {
      const status = (e as any)?.status;
      if (typeof status === 'number' && isAuthStatus(status)) {
        setAuthRequired(true);
      }
      setDeals(prev);
      throw e;
    }
  }, [deals, userId]);

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
      clearAll,
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
      clearAll,
    ],
  );
}
