import { LEGAL_PAGE_UPDATED_DATE } from '@/lib/legalCopy';

export const metadata = {
  title: 'Cookie Policy',
  description: 'How PropNexus uses cookies and similar technologies',
};

export default function CookiesPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">Cookie Policy</h1>
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Last updated: {LEGAL_PAGE_UPDATED_DATE}</p>

      <div className="mt-8 space-y-8 text-slate-700 dark:text-slate-300">
        <section>
          <h2 className="mb-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">How We Use Cookies</h2>
          <p className="leading-7">
            PropNexus may use cookies, local storage and similar technologies to keep the service working, protect accounts,
            remember preferences and understand whether key product flows are operating reliably.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">Essential Cookies</h2>
          <p className="leading-7">
            Essential cookies may be used for authentication, security, session management, load balancing and payment or
            account workflows. Blocking essential cookies may prevent parts of PropNexus from working correctly.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">Third-Party Services</h2>
          <p className="leading-7">
            Authentication, hosting, database and payment providers may set cookies or similar storage where needed to
            provide their services. This can include Clerk, Supabase, Stripe, Vercel or similar providers configured for
            the platform.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">Analytics and Monitoring</h2>
          <p className="leading-7">
            Analytics or monitoring cookies are used only where the relevant tools are configured. We use operational and
            usage signals to improve reliability, diagnose issues and understand feature usage. We do not use this page to
            claim a consent-management system that has not been implemented.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">Your Choices</h2>
          <p className="leading-7">
            You can manage or delete cookies in your browser settings. If PropNexus adds a cookie banner or preference
            centre in the future, those controls will apply alongside your browser settings.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">Contact</h2>
          <p className="leading-7">
            Questions about cookies or privacy can be sent to{' '}
            <a href="mailto:privacy@propnexus.com" className="text-brand-600 hover:text-brand-700 dark:text-brand-400">
              privacy@propnexus.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
