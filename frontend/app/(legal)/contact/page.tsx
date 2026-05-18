import { LEGAL_PAGE_UPDATED_DATE } from '@/lib/legalCopy';

export const metadata = {
  title: 'Contact',
  description: 'Contact PropNexus support',
};

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">Contact</h1>
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
        Last updated: {LEGAL_PAGE_UPDATED_DATE}
      </p>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Support</h2>
        <p className="mt-3 leading-7 text-slate-700 dark:text-slate-300">
          For account, billing, privacy or product questions, contact PropNexus at{' '}
          <a href="mailto:support@propnexus.com" className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
            support@propnexus.com
          </a>
          . Please do not send passwords, API keys, payment card numbers or other secrets by email.
        </p>
        <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
          PropNexus is not the seller, estate agent, broker, lender or legal adviser for listed properties.
          Viewing and availability questions should be confirmed through the original listing or agent.
        </p>
      </section>
    </main>
  );
}
