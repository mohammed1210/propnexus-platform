import {
  AI_DISCLAIMER,
  DATA_ACCURACY_DISCLAIMER,
  INVESTMENT_DISCLAIMER_FULL,
  LEGAL_PAGE_UPDATED_DATE,
} from '@/lib/legalCopy';

export const metadata = {
  title: 'Terms of Service',
  description: 'Terms and conditions for using PropNexus Platform',
};

export default function TermsPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-4xl font-bold mb-8 text-slate-900 dark:text-slate-100">
        Terms of Service
      </h1>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
        <section>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Last updated: {LEGAL_PAGE_UPDATED_DATE}
          </p>

          <p className="text-slate-700 dark:text-slate-300">
            Welcome to PropNexus. By accessing or using our platform, you agree to be bound by
            these Terms of Service. Please read them carefully.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            1. Acceptance of Terms
          </h2>
          <p className="text-slate-700 dark:text-slate-300">
            By creating an account or using PropNexus services, you acknowledge that you have
            read, understood, and agree to be bound by these Terms of Service and our Privacy Policy.
            If you do not agree to these terms, please do not use our platform.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            2. Service Description
          </h2>
          <p className="text-slate-700 dark:text-slate-300 mb-4">
            PropNexus is a software and information tool that helps users review property data,
            estimated metrics and workflow notes. It provides:
          </p>
          <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
            <li>Property listings aggregated from multiple sources</li>
            <li>AI-assisted summaries, indicative scoring and review workflows</li>
            <li>Deal tracking and portfolio management tools</li>
            <li>Market intelligence and comparable property data</li>
            <li>Subscription-based access to premium features</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            3. User Accounts
          </h2>
          <p className="text-slate-700 dark:text-slate-300">
            You are responsible for maintaining the confidentiality of your account credentials
            and for all activities that occur under your account. You agree to notify us immediately
            of any unauthorized use of your account.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            4. Subscription Plans
          </h2>
          <p className="text-slate-700 dark:text-slate-300 mb-4">
            We may offer subscription tiers with varying features and access levels. Payments,
            invoices, trials, renewals and cancellations are handled through our payment provider,
            Stripe, where applicable. Paid subscriptions:
          </p>
          <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
            <li>Are billed according to the plan and checkout terms shown when you subscribe</li>
            <li>Automatically renew unless cancelled</li>
            <li>Can be cancelled at any time from your account settings</li>
            <li>Provide access until the end of the current billing period after cancellation</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            5. Acceptable Use
          </h2>
          <p className="text-slate-700 dark:text-slate-300 mb-4">
            You agree not to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
            <li>Use the platform for any illegal purposes</li>
            <li>Attempt to gain unauthorized access to our systems</li>
            <li>Scrape, copy, or redistribute platform data without permission</li>
            <li>Share your account credentials with others</li>
            <li>Abuse or overload our API or services</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            6. Data Accuracy and Investment Decisions
          </h2>
          <p className="text-slate-700 dark:text-slate-300">
            {INVESTMENT_DISCLAIMER_FULL}
          </p>
          <p className="mt-4 text-slate-700 dark:text-slate-300">
            {DATA_ACCURACY_DISCLAIMER} We do not guarantee data accuracy, completeness,
            profitability, finance approval, below-market purchases, availability or any property
            outcome.
          </p>
          <p className="mt-4 text-slate-700 dark:text-slate-300">
            {AI_DISCLAIMER}
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            7. Third-Party Listings and Sources
          </h2>
          <p className="text-slate-700 dark:text-slate-300">
            PropNexus may link to third-party listing portals, agents, datasets or public sources.
            Those services are external to PropNexus and may change, remove, restrict or correct
            information independently. Users should verify availability, price, condition, tenure,
            legal pack, finance and viewing details through the original listing or agent.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            8. Intellectual Property
          </h2>
          <p className="text-slate-700 dark:text-slate-300">
            All content, features, and functionality of PropNexus are owned by us or our licensors
            and are protected by copyright, trademark, and other intellectual property laws.
            You may not reproduce, distribute, or create derivative works without our express permission.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            9. Limitation of Liability
          </h2>
          <p className="text-slate-700 dark:text-slate-300">
            To the fullest extent permitted by law, PropNexus shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages arising out of or relating to
            your use of the platform, even if we have been advised of the possibility of such damages.
            In plain English: you remain responsible for checking whether a property, finance route
            or strategy is suitable before acting.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            10. Changes to Terms
          </h2>
          <p className="text-slate-700 dark:text-slate-300">
            We reserve the right to modify these Terms of Service at any time. We will notify
            users of material changes via email or platform notification. Your continued use
            of PropNexus after such changes constitutes acceptance of the new terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            11. Contact Us
          </h2>
          <p className="text-slate-700 dark:text-slate-300">
            If you have questions about these Terms of Service, please contact us at:{' '}
            <a href="mailto:support@propnexus.com" className="text-brand-600 hover:text-brand-700 dark:text-brand-400">
              support@propnexus.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
