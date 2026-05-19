'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiCheckCircle, FiChevronDown, FiClipboard, FiExternalLink, FiMail, FiPhone } from 'react-icons/fi';
import { toast } from 'sonner';
import InfoDisclaimer from '@/components/legal/InfoDisclaimer';
import { CONTACT_ORIGINAL_LISTING_DISCLAIMER } from '@/lib/legalCopy';

import {
  buildInvestorEnquiry,
  getAgentEmail,
  getAgentName,
  getAgentPhone,
  getDealActionChecklist,
  getOriginalListingUrl,
  getSourceLabel,
} from '@/lib/propertyDealActions';

export type DealActionPanelProps = {
  propertyId: string;
  property?: Record<string, any> | null;
  compact?: boolean;
};

const DEAL_STATUS_OPTIONS = [
  ['not_contacted', 'Not contacted'],
  ['contacted', 'Contacted'],
  ['viewing_booked', 'Viewing booked'],
  ['offer_prepared', 'Offer prepared'],
  ['offer_made', 'Offer made'],
  ['rejected', 'Rejected'],
  ['archived', 'Archived'],
] as const;

type DealStatus = (typeof DEAL_STATUS_OPTIONS)[number][0];

function sourceButtonLabel(source: string): string {
  if (source === 'Rightmove') return 'View on Rightmove';
  if (source === 'Zoopla') return 'View on Zoopla';
  if (source === 'OnTheMarket') return 'View on OnTheMarket';
  if (source === 'OpenRent') return 'View on OpenRent';
  return 'View original listing';
}

function findSavedDeal(payload: any, propertyId: string): any | null {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.deals)
      ? payload.deals
      : Array.isArray(payload?.data)
        ? payload.data
        : [];
  return list.find((deal: any) => String(deal?.property_id ?? deal?.property?.id ?? '') === String(propertyId)) ?? null;
}

export default function DealActionPanel({ propertyId, property, compact = false }: DealActionPanelProps) {
  const [copied, setCopied] = useState(false);
  const [savedDeal, setSavedDeal] = useState<any | null>(null);
  const [status, setStatus] = useState<DealStatus>('not_contacted');
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [copyChecklistOpen, setCopyChecklistOpen] = useState(!compact);

  const originalUrl = useMemo(() => getOriginalListingUrl(property), [property]);
  const sourceLabel = useMemo(() => getSourceLabel(property), [property]);
  const agentName = useMemo(() => getAgentName(property), [property]);
  const agentPhone = useMemo(() => getAgentPhone(property), [property]);
  const agentEmail = useMemo(() => getAgentEmail(property), [property]);
  const enquiry = useMemo(() => buildInvestorEnquiry(property), [property]);
  const checklist = useMemo(() => getDealActionChecklist(property).slice(0, compact ? 5 : 6), [compact, property]);
  const hasDirectContact = Boolean(agentPhone || agentEmail);
  const contactHeading = originalUrl && !hasDirectContact ? 'Contact via original listing' : 'Contact agent';

  useEffect(() => {
    let cancelled = false;
    async function loadSavedDeal() {
      try {
        setLoadingSaved(true);
        const res = await fetch(`/api/saved-deals?property_id=${encodeURIComponent(propertyId)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        const deal = findSavedDeal(json, propertyId);
        setSavedDeal(deal);
        const nextStatus = deal?.deal_status ?? deal?.property?.deal_status;
        if (DEAL_STATUS_OPTIONS.some(([value]) => value === nextStatus)) {
          setStatus(nextStatus);
        }
      } catch {
        // Saved state is optional for this panel.
      } finally {
        if (!cancelled) setLoadingSaved(false);
      }
    }
    void loadSavedDeal();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const handleCopyEnquiry = async () => {
    try {
      await navigator.clipboard.writeText(enquiry);
      setCopied(true);
      toast.success('Enquiry message copied.');
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Could not copy enquiry message.');
    }
  };

  const handleStatusChange = async (nextStatus: DealStatus) => {
    const previous = status;
    setStatus(nextStatus);
    setSavingStatus(true);
    try {
      const res = await fetch('/api/saved-deals/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId, status: nextStatus }),
        cache: 'no-store',
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Status update failed (${res.status})`);
      }
      const json = await res.json().catch(() => null);
      setSavedDeal((current: any) => ({ ...(current ?? {}), ...(json?.data?.[0] ?? json?.data ?? {}), deal_status: nextStatus }));
      toast.success('Deal progress updated.');
    } catch (err) {
      setStatus(previous);
      toast.error('Could not update deal progress.');
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <section className={`rounded-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 ${compact ? 'p-3' : 'p-4'}`}>
      <div className={compact ? 'mb-2' : 'mb-3'}>
        <h3 className="font-bold text-[11px] uppercase tracking-[0.16em] text-slate-900 dark:text-white">
          Deal Action
        </h3>
        <p className={`${compact ? 'mt-0.5' : 'mt-1'} text-xs text-slate-500 dark:text-slate-400`}>Move from analysis to enquiry.</p>
      </div>

      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        {originalUrl ? (
          <a
            href={originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-950 text-center text-sm font-semibold leading-tight text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}
          >
            <FiExternalLink className="h-4 w-4" aria-hidden="true" />
            <span className="whitespace-normal">{sourceButtonLabel(sourceLabel)}</span>
          </a>
        ) : null}

        <div className={`rounded-lg border border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/40 ${compact ? 'p-2.5' : 'p-3'}`}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {contactHeading}
          </div>
          {agentName ? <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{agentName}</div> : null}
          <div className={`${compact ? 'mt-1.5 space-y-1.5' : 'mt-2 space-y-2'}`}>
            {agentPhone ? (
              <a href={`tel:${agentPhone}`} className="flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
                <FiPhone className="h-4 w-4" aria-hidden="true" />
                {agentPhone}
              </a>
            ) : null}
            {agentEmail ? (
              <a href={`mailto:${agentEmail}`} className="flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
                <FiMail className="h-4 w-4" aria-hidden="true" />
                {agentEmail}
              </a>
            ) : null}
            {!agentPhone && !agentEmail && originalUrl ? (
              <div>
                <a
                  href={originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
                >
                  Contact via original listing
                  <FiExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                  PropNexus sends you to the verified source listing so you can enquire directly.
                </p>
              </div>
            ) : null}
            {!agentPhone && !agentEmail && !originalUrl ? (
              <div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Agent contact unavailable</div>
                <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                  Open the source listing when available. PropNexus only shows verified source/contact details.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className={`rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/30 ${compact ? 'p-2.5' : 'p-3'}`}>
          <button
            type="button"
            onClick={() => setCopyChecklistOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 transition hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-300 dark:hover:text-white"
            aria-expanded={copyChecklistOpen}
          >
            <span>Copy and checklist</span>
            <FiChevronDown
              className={`h-4 w-4 shrink-0 transition-transform ${copyChecklistOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {copyChecklistOpen ? (
            <div className={compact ? 'mt-2 space-y-2' : 'mt-3 space-y-3'}>
              <button
                type="button"
                onClick={handleCopyEnquiry}
                className={`flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:border-brand-500 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-brand-300 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}
              >
                {copied ? <FiCheckCircle className="h-4 w-4" aria-hidden="true" /> : <FiClipboard className="h-4 w-4" aria-hidden="true" />}
                <span>{copied ? 'Copied' : 'Copy enquiry'}</span>
              </button>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Before offer checklist
                </div>
                <ul className={`${compact ? 'mt-1.5 space-y-1' : 'mt-2 space-y-1.5'}`}>
                  {checklist.map((item) => (
                    <li key={item} className="flex gap-2 text-xs leading-4 text-slate-600 dark:text-slate-300">
                      <FiCheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>

        <div className={`rounded-lg border border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/40 ${compact ? 'p-2.5' : 'p-3'}`}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Deal progress
          </div>
          {savedDeal ? (
            <label className="mt-2 block text-xs text-slate-600 dark:text-slate-300">
              Contact status
              <select
                value={status}
                disabled={savingStatus}
                onChange={(event) => void handleStatusChange(event.target.value as DealStatus)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {DEAL_STATUS_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="mt-1 text-xs leading-4 text-slate-500 dark:text-slate-400">
              {loadingSaved ? 'Checking saved deal status…' : 'Save this deal to track contact progress.'}
            </p>
          )}
        </div>

        <InfoDisclaimer label="Original listing disclaimer">
          {CONTACT_ORIGINAL_LISTING_DISCLAIMER} Use the original listing to confirm availability, price and viewing details.
        </InfoDisclaimer>
      </div>
    </section>
  );
}
