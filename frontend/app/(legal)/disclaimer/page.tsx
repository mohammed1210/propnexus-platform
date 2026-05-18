import LegalNotice from '@/components/legal/LegalNotice';
import {
  AI_DISCLAIMER,
  AREA_INTEL_DISCLAIMER,
  COMPS_DISCLAIMER,
  CONTACT_ORIGINAL_LISTING_DISCLAIMER,
  DATA_ACCURACY_DISCLAIMER,
  INVESTMENT_DISCLAIMER_FULL,
  LEGAL_PAGE_UPDATED_DATE,
  RENT_ESTIMATE_DISCLAIMER,
  SOFT_LAUNCH_BETA_NOTICE,
} from '@/lib/legalCopy';

export const metadata = {
  title: 'Disclaimer',
  description: 'Important PropNexus information, data and investment disclaimers',
};

const sections = [
  ['Investment and advice disclaimer', INVESTMENT_DISCLAIMER_FULL],
  ['AI outputs', AI_DISCLAIMER],
  ['Data accuracy', DATA_ACCURACY_DISCLAIMER],
  ['Area intelligence', AREA_INTEL_DISCLAIMER],
  ['Comparable evidence', COMPS_DISCLAIMER],
  ['Rent estimates', RENT_ESTIMATE_DISCLAIMER],
  ['Original listings and enquiries', CONTACT_ORIGINAL_LISTING_DISCLAIMER],
  ['Soft-launch beta', SOFT_LAUNCH_BETA_NOTICE],
] as const;

export default function DisclaimerPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">Disclaimer</h1>
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
        Last updated: {LEGAL_PAGE_UPDATED_DATE}
      </p>

      <div className="mt-8 space-y-5">
        <LegalNotice title="Important" variant="warning">
          {INVESTMENT_DISCLAIMER_FULL}
        </LegalNotice>

        {sections.slice(1).map(([title, copy]) => (
          <section key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            <p className="mt-2 leading-7 text-slate-700 dark:text-slate-300">{copy}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
