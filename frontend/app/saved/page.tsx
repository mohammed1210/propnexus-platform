"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { normalizeProperty } from "@/lib/normalizeProperty";

/**
 * =========================
 * Saved Deals — Production Page
 * =========================
 * - Fetch saved deals for Clerk userId
 * - Fetch property details for each saved deal
 * - Show cards + compare (2–4)
 * - Robust loading/error/empty states
 * - Metric normalization (scraped vs placeholder fields)
 *
 * Backend endpoints expected:
 *  - GET    /saved-deals?user_id=<clerk_user_id>
 *  - DELETE /save-deal?user_id=<clerk_user_id>&property_id=<uuid>   (or /saved-deal depending on backend)
 *  - GET    /properties/<uuid>
 */

// ---------- Config ----------
function getApiBase() {
  // Prefer your existing env name(s)
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_RAILWAY_BACKEND_URL ||
    ""
  ).replace(/\/$/, "");
}

const API_BASE = getApiBase();

// ---------- Types ----------
type SavedDealRow = {
  id?: string;
  property_id: string;
  // backend may return different timestamp fields
  created_at?: string;
  saved_at?: string;
  inserted_at?: string;
  createdAt?: string;
};

type AnyObj = Record<string, any>;

// ---------- Helpers ----------
function isFiniteNumber(v: any): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function formatGBP(amount: number | null) {
  if (!isFiniteNumber(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `£${Math.round(amount)}`;
  }
}

function formatPct(p: number | null) {
  if (!isFiniteNumber(p)) return "—";
  // keep one decimal max unless whole
  const v = Math.round(p * 10) / 10;
  return `${v}%`;
}

function safeText(v: any, fallback = "—") {
  const s = (v ?? "").toString().trim();
  return s ? s : fallback;
}

function formatDate(d?: string) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(dt);
  } catch {
    return dt.toISOString().slice(0, 10);
  }
}

function safeHttpImageUrl(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Normalize obvious bad URLs (spaces) without breaking already-encoded ones.
  const normalized = trimmed.includes(" ") ? trimmed.replace(/\s/g, "%20") : trimmed;
  try {
    const u = new URL(normalized);
    if (u.protocol === "http:" || u.protocol === "https:") return normalized;
  } catch {
    // ignore
  }
  return null;
}

// Simple toast (no dependency)
function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const tRef = useRef<any>(null);

  const show = useCallback((m: string) => {
    setMsg(m);
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setMsg(null), 2600);
  }, []);

  const Toast = useMemo(() => {
    if (!msg) return null;
    return (
      <div
        style={{
          position: "fixed",
          bottom: 18,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(15, 23, 42, 0.92)",
          color: "white",
          padding: "10px 14px",
          borderRadius: 12,
          fontSize: 13,
          zIndex: 9999,
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          maxWidth: 360,
          textAlign: "center",
        }}
      >
        {msg}
      </div>
    );
  }, [msg]);

  return { show, Toast };
}

// ---------- Page ----------
export default function SavedDealsPage() {
  const { userId } = useAuth();
  const { show, Toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [savedRows, setSavedRows] = useState<SavedDealRow[]>([]);
  const [propertiesById, setPropertiesById] = useState<Record<string, ReturnType<typeof normalizeProperty>>>({});
  const [removedIds, setRemovedIds] = useState<Record<string, boolean>>({});

  // compare selection (max 4)
  const [selected, setSelected] = useState<string[]>([]);

  const savedCount = savedRows.filter((r) => !removedIds[r.property_id]).length;

  const apiFetch = useCallback(async (path: string, init?: RequestInit) => {
    if (!API_BASE) throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Request failed: ${res.status}`);
    }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    return res.text();
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);

    const rows = (await apiFetch(`/saved-deals?user_id=${encodeURIComponent(userId)}`)) as any;
    const list: SavedDealRow[] = Array.isArray(rows) ? rows : rows?.data ?? [];

    setSavedRows(list);

    // Fetch property details in parallel
    const ids = list.map((r) => r.property_id).filter(Boolean);

    const batch: Record<string, ReturnType<typeof normalizeProperty>> = {};
    await Promise.all(
      ids.map(async (pid) => {
        try {
          const p = (await apiFetch(`/properties/${encodeURIComponent(pid)}`)) as any;
          // backend might wrap
          const raw = p?.data ?? p;
          batch[pid] = normalizeProperty(raw);
        } catch (e) {
          // Keep page usable even if some details fail
          batch[pid] = normalizeProperty({ id: pid, title: "Property unavailable", location: "", price: null });
        }
      })
    );

    setPropertiesById(batch);
  }, [apiFetch, userId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        if (!userId) return;
        await load();
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load saved deals.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userId, load]);

  const refresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await load();
      show("Saved deals refreshed");
    } catch (e: any) {
      setError(e?.message || "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }, [load, show]);

  const removeDeal = useCallback(
    async (propertyId: string) => {
      if (!userId) return;

      // optimistic UI
      setRemovedIds((prev) => ({ ...prev, [propertyId]: true }));
      setSelected((prev) => prev.filter((id) => id !== propertyId));

      try {
        // backend route naming may be /save-deal (DELETE) or /saved-deal (DELETE)
        // try /save-deal first; fallback to /saved-deal if needed
        try {
          await apiFetch(
            `/save-deal?user_id=${encodeURIComponent(userId)}&property_id=${encodeURIComponent(propertyId)}`,
            {
              method: "DELETE",
            }
          );
        } catch {
          await apiFetch(
            `/saved-deal?user_id=${encodeURIComponent(userId)}&property_id=${encodeURIComponent(propertyId)}`,
            {
              method: "DELETE",
            }
          );
        }

        show("Removed from Saved Deals");
      } catch (e: any) {
        // rollback
        setRemovedIds((prev) => {
          const copy = { ...prev };
          delete copy[propertyId];
          return copy;
        });
        show("Could not remove deal");
      }
    },
    [apiFetch, show, userId]
  );

  const clearAll = useCallback(async () => {
    if (!userId) return;
    const ok = window.confirm("Remove all saved deals? This cannot be undone.");
    if (!ok) return;

    const ids = savedRows.map((r) => r.property_id).filter(Boolean);

    // optimistic
    const optimistic: Record<string, boolean> = {};
    ids.forEach((id) => (optimistic[id] = true));
    setRemovedIds(optimistic);
    setSelected([]);

    try {
      // If backend has a bulk endpoint, use it; otherwise delete one-by-one
      // We'll attempt /saved-deals (DELETE) first, then fallback.
      let bulkWorked = false;
      try {
        await apiFetch(`/saved-deals?user_id=${encodeURIComponent(userId)}`, { method: "DELETE" });
        bulkWorked = true;
      } catch {
        bulkWorked = false;
      }

      if (!bulkWorked) {
        await Promise.allSettled(
          ids.map((pid) =>
            apiFetch(
              `/save-deal?user_id=${encodeURIComponent(userId)}&property_id=${encodeURIComponent(pid)}`,
              {
                method: "DELETE",
              }
            ).catch(() =>
              apiFetch(
                `/saved-deal?user_id=${encodeURIComponent(userId)}&property_id=${encodeURIComponent(pid)}`,
                {
                  method: "DELETE",
                }
              )
            )
          )
        );
      }

      show("Cleared all saved deals");
    } catch {
      show("Could not clear all deals");
      // reload to restore truth
      refresh();
    }
  }, [apiFetch, refresh, savedRows, show, userId]);

  const toggleCompare = useCallback(
    (propertyId: string) => {
      setSelected((prev) => {
        const exists = prev.includes(propertyId);
        if (exists) return prev.filter((id) => id !== propertyId);

        if (prev.length >= 4) {
          show("You can compare up to 4 deals.");
          return prev;
        }
        return [...prev, propertyId];
      });
    },
    [show]
  );

  const clearCompare = useCallback(() => {
    setSelected([]);
    show("Compare cleared");
  }, [show]);

  const visibleRows = useMemo(() => savedRows.filter((r) => !removedIds[r.property_id]), [savedRows, removedIds]);

  const selectedProps = useMemo(() => {
    return selected.map((id) => propertiesById[id]).filter(Boolean);
  }, [selected, propertiesById]);

  const showCompare = selected.length >= 2;

  // ---------- UI Pieces ----------
  const SkeletonCard = () => (
    <div className="saved-card saved-card--skeleton">
      <div className="saved-skel saved-skel-img" />
      <div className="saved-skel saved-skel-line" />
      <div className="saved-skel saved-skel-line short" />
      <div className="saved-skel saved-skel-line" />
      <div className="saved-skel saved-skel-btn" />
    </div>
  );

  return (
    <div className="saved-page">
      {Toast}

      {/* ===== Header ===== */}
      <div className="saved-header">
        <div className="saved-header-left">
          <h1 className="saved-title">Saved Deals</h1>
          <p className="saved-subtitle">
            Select <b>2–4</b> deals to compare side-by-side.
          </p>

          <div className="saved-meta">
            <span className="saved-count">{loading ? "…" : `${savedCount} saved`}</span>
            {error ? <span className="saved-error-pill">Error</span> : null}
          </div>
        </div>

        <div className="saved-header-actions">
          {selected.length > 0 ? (
            <button className="btn btn-secondary" onClick={clearCompare} type="button">
              Clear compare ({selected.length})
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={() => show("Select 2–4 deals to compare")} type="button">
              Compare (0)
            </button>
          )}

          <button className="btn btn-primary" onClick={refresh} type="button" disabled={refreshing || loading}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>

          <button className="btn btn-danger-ghost" onClick={clearAll} type="button" disabled={loading || savedCount === 0}>
            Clear all
          </button>
        </div>
      </div>

      {/* ===== Error Banner ===== */}
      {error ? (
        <div className="saved-banner saved-banner--error">
          <div>
            <b>Couldn’t load saved deals.</b> <span className="muted">{safeText(error)}</span>
          </div>
          <div className="saved-banner-actions">
            <button className="btn btn-secondary" onClick={refresh} type="button">
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {/* ===== Empty State ===== */}
      {!loading && !error && visibleRows.length === 0 ? (
        <div className="saved-empty">
          <div className="saved-empty-card">
            <h2>No saved deals yet</h2>
            <p className="muted">Start saving deals from Listings. Your saved deals will appear here for quick comparison.</p>
            <Link className="btn btn-primary" href="/listings">
              Browse Listings
            </Link>
          </div>
        </div>
      ) : null}

      {/* ===== Cards Grid ===== */}
      {loading ? (
        <div className="saved-grid">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : null}

      {!loading && visibleRows.length > 0 ? (
        <div className="saved-grid">
          {visibleRows.map((row) => {
            const p = propertiesById[row.property_id];
            const normalized = p || normalizeProperty({ id: row.property_id, title: "Loading…", location: "" } as AnyObj);

            const savedAt = row.created_at || row.saved_at || row.inserted_at || row.createdAt || "";
            const isSelected = selected.includes(row.property_id);

            // show “—” when missing; show 0.0% only if truly 0
            const yieldLabel = normalized.yieldPct === null ? "—" : formatPct(normalized.yieldPct);
            const roiLabel = normalized.roiPct === null ? "—" : formatPct(normalized.roiPct);

            const imageUrl = safeHttpImageUrl(normalized.imageUrl);

            return (
              <div className="saved-card" key={row.property_id}>
                <div className="saved-card-top">
                  <label className={`compare-pill ${isSelected ? "active" : ""}`}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleCompare(row.property_id)} />
                    <span>Compare</span>
                  </label>
                </div>

                <div className="saved-image">
                  {imageUrl ? (
                    // use normal img to avoid Next image domain config issues
                    <img
                      src={imageUrl}
                      alt={normalized.title}
                      loading="lazy"
                      onError={(e) => {
                        // prevent console spam + broken images
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="saved-image-fallback">
                      <span>PN</span>
                    </div>
                  )}
                </div>

                <div className="saved-card-body">
                  <div className="saved-row">
                    <div className="saved-title-wrap">
                      <div className="saved-card-title" title={normalized.title}>
                        {normalized.title}
                      </div>
                      <div className="saved-card-loc">{safeText(normalized.location, "—")}</div>
                    </div>

                    <div className="saved-price-wrap">
                      <div className="saved-card-price">{formatGBP(normalized.price)}</div>
                      <div className="saved-saved-at">
                        {savedAt ? (
                          <>
                            <span className="muted">Saved</span>
                            <span>{formatDate(savedAt)}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="saved-chips">
                    <span className="chip">
                      {normalized.bedrooms ?? "—"} beds • {normalized.bathrooms ?? "—"} baths
                    </span>
                    <span className="chip chip-green">Yield {yieldLabel}</span>
                    <span className="chip chip-blue">ROI {roiLabel}</span>
                  </div>

                  <div className="saved-metrics-line">
                    <span>
                      <b>Score:</b> {safeText(normalized.raw?.ai_score ?? normalized.raw?.score ?? "—")}/100
                    </span>
                    <span>
                      <b>Rent/mo:</b> {normalized.rentPcm === null ? "—" : formatGBP(normalized.rentPcm)}
                    </span>
                    <span>
                      <b>Area:</b> {safeText(normalized.areaLabel, "—")}
                    </span>
                  </div>

                  <div className="saved-actions">
                    <Link className="btn btn-secondary" href={`/property/${row.property_id}`}>
                      View
                    </Link>
                    <button className="btn btn-danger" type="button" onClick={() => removeDeal(row.property_id)}>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ===== Compare Section ===== */}
      {showCompare ? (
        <div className="compare-section">
          <div className="compare-header">
            <div>
              <h2 className="compare-title">Deal comparison</h2>
              <p className="muted">Side-by-side for {selected.length} deal{selected.length === 1 ? "" : "s"}</p>
            </div>

            <button className="btn btn-secondary" onClick={clearCompare} type="button">
              Clear
            </button>
          </div>

          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th className="metric-col">Metric</th>
                  {selectedProps.map((p) => (
                    <th key={p.id}>
                      <div className="compare-col-title" title={p.title}>
                        {p.title}
                      </div>
                      <div className="muted small">{safeText(p.location, "—")}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="metric-col">Price</td>
                  {selectedProps.map((p) => (
                    <td key={p.id}>{formatGBP(p.price)}</td>
                  ))}
                </tr>
                <tr>
                  <td className="metric-col">Beds / Baths</td>
                  {selectedProps.map((p) => (
                    <td key={p.id}>
                      {(p.bedrooms ?? "—")}/{(p.bathrooms ?? "—")}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="metric-col">Score</td>
                  {selectedProps.map((p) => (
                    <td key={p.id}>{safeText(p.raw?.ai_score ?? p.raw?.score ?? "—")}/100</td>
                  ))}
                </tr>
                <tr>
                  <td className="metric-col">Yield</td>
                  {selectedProps.map((p) => (
                    <td key={p.id}>{p.yieldPct === null ? "—" : formatPct(p.yieldPct)}</td>
                  ))}
                </tr>
                <tr>
                  <td className="metric-col">ROI</td>
                  {selectedProps.map((p) => (
                    <td key={p.id}>{p.roiPct === null ? "—" : formatPct(p.roiPct)}</td>
                  ))}
                </tr>
                <tr>
                  <td className="metric-col">Rent / mo</td>
                  {selectedProps.map((p) => (
                    <td key={p.id}>{p.rentPcm === null ? "—" : formatGBP(p.rentPcm)}</td>
                  ))}
                </tr>
                <tr>
                  <td className="metric-col">Area</td>
                  {selectedProps.map((p) => (
                    <td key={p.id}>{safeText(p.areaLabel, "—")}</td>
                  ))}
                </tr>
                <tr>
                  <td className="metric-col">Actions</td>
                  {selectedProps.map((p) => (
                    <td key={p.id} className="compare-actions">
                      <Link className="btn btn-secondary" href={`/property/${p.id}`}>
                        View
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : !loading && visibleRows.length > 0 ? (
        <div className="compare-hint">
          <span className="muted">Tip:</span> Select <b>2–4</b> deals using the <b>Compare</b> checkbox to see a side-by-side table.
        </div>
      ) : null}

      {/* ===== Page styles (scoped) ===== */}
      <style jsx>{`
        .saved-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 18px 16px 60px;
        }

        .saved-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          padding: 10px 0 14px;
          border-bottom: 1px solid rgba(0,0,0,0.08);
          margin-bottom: 14px;
        }

        .saved-title {
          font-size: 26px;
          margin: 0 0 6px;
          line-height: 1.1;
        }

        .saved-subtitle {
          margin: 0;
          color: rgba(0,0,0,0.64);
          font-size: 14px;
        }

        .saved-meta {
          margin-top: 8px;
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .saved-count {
          font-size: 13px;
          color: rgba(0,0,0,0.6);
        }

        .saved-error-pill {
          font-size: 12px;
          padding: 3px 8px;
          border-radius: 999px;
          background: rgba(220, 38, 38, 0.12);
          color: rgb(185, 28, 28);
          border: 1px solid rgba(220, 38, 38, 0.25);
        }

        .saved-header-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .saved-banner {
          border-radius: 14px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 14px;
          border: 1px solid rgba(0,0,0,0.08);
          background: rgba(255,255,255,0.7);
          backdrop-filter: blur(6px);
        }

        .saved-banner--error {
          border-color: rgba(220,38,38,0.25);
          background: rgba(220,38,38,0.08);
        }

        .saved-banner-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .saved-empty {
          padding: 24px 0;
          display: flex;
          justify-content: center;
        }

        .saved-empty-card {
          width: min(620px, 100%);
          padding: 18px;
          border-radius: 16px;
          border: 1px solid rgba(0,0,0,0.08);
          background: rgba(255,255,255,0.7);
          backdrop-filter: blur(6px);
        }

        .muted { color: rgba(0,0,0,0.62); }
        .small { font-size: 12px; }

        .saved-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-top: 12px;
        }

        .saved-card {
          border-radius: 18px;
          border: 1px solid rgba(0,0,0,0.08);
          background: rgba(255,255,255,0.75);
          backdrop-filter: blur(6px);
          overflow: hidden;
          box-shadow: 0 10px 28px rgba(0,0,0,0.06);
          position: relative;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .saved-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 34px rgba(0,0,0,0.09);
        }

        .saved-card-top {
          position: absolute;
          top: 10px;
          left: 10px;
          z-index: 3;
        }

        .compare-pill {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          padding: 8px 10px;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,0.12);
          background: rgba(255,255,255,0.85);
          font-size: 13px;
          cursor: pointer;
          user-select: none;
        }

        .compare-pill input { accent-color: #0f766e; }
        .compare-pill.active {
          border-color: rgba(15,118,110,0.35);
          background: rgba(15,118,110,0.10);
        }

        .saved-image {
          height: 190px;
          background: rgba(0,0,0,0.03);
          overflow: hidden;
        }

        .saved-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .saved-image-fallback {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, rgba(15,118,110,0.18), rgba(2,132,199,0.14));
          color: rgba(15,23,42,0.85);
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .saved-card-body {
          padding: 12px 12px 14px;
        }

        .saved-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .saved-title-wrap { min-width: 0; }
        .saved-card-title {
          font-weight: 800;
          font-size: 15px;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        .saved-card-loc {
          font-size: 13px;
          color: rgba(0,0,0,0.6);
          margin-top: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .saved-price-wrap {
          text-align: right;
          flex: 0 0 auto;
        }

        .saved-card-price {
          font-weight: 900;
          font-size: 16px;
        }

        .saved-saved-at {
          margin-top: 2px;
          display: grid;
          gap: 2px;
          font-size: 12px;
          color: rgba(0,0,0,0.55);
        }

        .saved-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }

        .chip {
          font-size: 12px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,0.08);
          background: rgba(255,255,255,0.6);
        }

        .chip-green {
          border-color: rgba(34,197,94,0.25);
          background: rgba(34,197,94,0.10);
          color: rgba(22,101,52,0.9);
          font-weight: 700;
        }

        .chip-blue {
          border-color: rgba(59,130,246,0.25);
          background: rgba(59,130,246,0.10);
          color: rgba(30,64,175,0.9);
          font-weight: 700;
        }

        .saved-metrics-line {
          margin-top: 10px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          font-size: 13px;
          color: rgba(0,0,0,0.7);
          border-top: 1px solid rgba(0,0,0,0.06);
          padding-top: 10px;
        }

        .saved-actions {
          margin-top: 12px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .compare-section {
          margin-top: 18px;
          padding: 14px;
          border-radius: 18px;
          border: 1px solid rgba(0,0,0,0.08);
          background: rgba(255,255,255,0.75);
          backdrop-filter: blur(6px);
          box-shadow: 0 10px 26px rgba(0,0,0,0.06);
        }

        .compare-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .compare-title {
          margin: 0;
          font-size: 18px;
        }

        .compare-table-wrap {
          overflow-x: auto;
          border-radius: 14px;
          border: 1px solid rgba(0,0,0,0.06);
        }

        .compare-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 720px;
          background: rgba(255,255,255,0.7);
        }

        .compare-table th,
        .compare-table td {
          padding: 12px 10px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          vertical-align: top;
          text-align: left;
          font-size: 14px;
        }

        .compare-table thead th {
          background: rgba(15,23,42,0.03);
          font-weight: 800;
        }

        .metric-col {
          width: 170px;
          color: rgba(0,0,0,0.7);
          font-weight: 800;
          white-space: nowrap;
        }

        .compare-col-title {
          font-weight: 900;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 260px;
        }

        .compare-actions {
          display: flex;
          gap: 8px;
        }

        .compare-hint {
          margin-top: 14px;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px dashed rgba(0,0,0,0.14);
          color: rgba(0,0,0,0.7);
        }

        /* Buttons */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 12px;
          padding: 10px 12px;
          font-weight: 800;
          font-size: 14px;
          border: 1px solid transparent;
          cursor: pointer;
          text-decoration: none;
          user-select: none;
          transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease, border-color 0.12s ease;
        }

        .btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-primary {
          background: rgba(15,118,110,0.95);
          color: white;
          box-shadow: 0 10px 22px rgba(15,118,110,0.22);
        }

        .btn-primary:hover { transform: translateY(-1px); }

        .btn-secondary {
          background: rgba(15,23,42,0.03);
          border-color: rgba(0,0,0,0.08);
          color: rgba(0,0,0,0.78);
        }

        .btn-secondary:hover { transform: translateY(-1px); }

        .btn-danger {
          background: rgba(220,38,38,0.08);
          border-color: rgba(220,38,38,0.25);
          color: rgb(185, 28, 28);
        }

        .btn-danger:hover { transform: translateY(-1px); }

        .btn-danger-ghost {
          background: transparent;
          border-color: rgba(220,38,38,0.22);
          color: rgb(185, 28, 28);
        }

        /* Skeleton */
        .saved-card--skeleton { padding-bottom: 12px; }
        .saved-skel {
          background: linear-gradient(90deg, rgba(0,0,0,0.06), rgba(0,0,0,0.03), rgba(0,0,0,0.06));
          background-size: 200% 100%;
          animation: shimmer 1.1s linear infinite;
          border-radius: 12px;
          margin: 12px;
        }
        .saved-skel-img { height: 170px; margin: 0; border-radius: 0; }
        .saved-skel-line { height: 14px; }
        .saved-skel-line.short { width: 70%; }
        .saved-skel-btn { height: 44px; }

        @keyframes shimmer {
          0% { background-position: 0% 0; }
          100% { background-position: 200% 0; }
        }

        /* Responsive */
        @media (max-width: 980px) {
          .saved-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media (max-width: 640px) {
          .saved-header { flex-direction: column; align-items: stretch; }
          .saved-header-actions { justify-content: flex-start; }
          .saved-grid { grid-template-columns: 1fr; }
          .compare-table { min-width: 640px; }
          .metric-col { width: 140px; }
        }

        /* Dark mode support if your app toggles data-theme or class on body/html */
        :global(html.dark) .saved-page,
        :global(body.dark) .saved-page {
          color: rgba(255,255,255,0.88);
        }

        :global(html.dark) .saved-header,
        :global(body.dark) .saved-header {
          border-bottom-color: rgba(255,255,255,0.10);
        }

        :global(html.dark) .saved-subtitle,
        :global(body.dark) .saved-subtitle,
        :global(html.dark) .muted,
        :global(body.dark) .muted {
          color: rgba(255,255,255,0.60);
        }

        :global(html.dark) .saved-card,
        :global(body.dark) .saved-card,
        :global(html.dark) .compare-section,
        :global(body.dark) .compare-section,
        :global(html.dark) .saved-empty-card,
        :global(body.dark) .saved-empty-card {
          background: rgba(15,23,42,0.55);
          border-color: rgba(255,255,255,0.10);
        }

        :global(html.dark) .chip,
        :global(body.dark) .chip {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.10);
          color: rgba(255,255,255,0.78);
        }

        :global(html.dark) .btn-secondary,
        :global(body.dark) .btn-secondary {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.10);
          color: rgba(255,255,255,0.82);
        }

        :global(html.dark) .compare-table thead th,
        :global(body.dark) .compare-table thead th {
          background: rgba(255,255,255,0.06);
        }

        :global(html.dark) .compare-table,
        :global(body.dark) .compare-table {
          background: rgba(15,23,42,0.40);
        }

        :global(html.dark) .compare-table th,
        :global(body.dark) .compare-table th,
        :global(html.dark) .compare-table td,
        :global(body.dark) .compare-table td {
          border-bottom-color: rgba(255,255,255,0.08);
        }
      `}</style>
    </div>
  );
}
