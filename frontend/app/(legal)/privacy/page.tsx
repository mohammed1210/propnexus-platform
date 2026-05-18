import { LEGAL_PAGE_UPDATED_DATE } from '@/lib/legalCopy';

export const metadata = {
  title: 'Privacy Policy',
  description: 'How PropNexus collects, uses, and protects your personal information',
};

export default function PrivacyPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-4xl font-bold mb-8 text-slate-900 dark:text-slate-100">
        Privacy Policy
      </h1>

      <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
        <section>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Last updated: {LEGAL_PAGE_UPDATED_DATE}
          </p>

          <p className="text-slate-700 dark:text-slate-300">
            This Privacy Policy explains how PropNexus may collect, use, disclose and safeguard
            information when you use the platform.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            1. Information We Collect
          </h2>

          <h3 className="text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200 mt-6">
            Personal Information
          </h3>
          <p className="text-slate-700 dark:text-slate-300 mb-4">
            We collect information that you provide directly to us, including:
          </p>
          <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
            <li>Account details such as name, email address and authentication identifiers</li>
            <li>Saved deals, searches, alerts, notes, shortlists and related workflow data</li>
            <li>Usage data such as pages visited, features used, events and device/browser details</li>
            <li>Payment and subscription identifiers handled by Stripe, such as customer or subscription IDs</li>
            <li>Authentication data handled through Clerk and/or Supabase depending on the active configuration</li>
            <li>Communications with our support team</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200 mt-6">
            Usage Information
          </h3>
          <p className="text-slate-700 dark:text-slate-300 mb-4">
            We automatically collect certain information about your device and usage:
          </p>
          <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
            <li>IP address and browser type</li>
            <li>Pages visited and features used</li>
            <li>Time and date of visits</li>
            <li>Referral sources</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            2. How We Use Your Information
          </h2>
          <p className="text-slate-700 dark:text-slate-300 mb-4">
            We use the information we collect to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
            <li>Provide, maintain, and improve our services</li>
            <li>Process your transactions and manage subscriptions</li>
            <li>Send you technical notices and support messages</li>
            <li>Respond to your comments and questions</li>
            <li>Send marketing communications (with your consent)</li>
            <li>Analyze usage patterns to improve user experience</li>
            <li>Detect and prevent fraud and abuse</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            3. Information Sharing
          </h2>
          <p className="text-slate-700 dark:text-slate-300 mb-4">
            We do not sell your personal information. We may share your information with:
          </p>
          <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
            <li>
              <strong>Service Providers:</strong> Third-party processors who help run the service,
              including hosting, database, authentication, payments, analytics/logging and email
              tools if configured
            </li>
            <li>
              <strong>Legal Requirements:</strong> When required by law or to protect our rights
            </li>
            <li>
              <strong>Business Transfers:</strong> In connection with a merger, acquisition, or
              sale of assets
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            4. Third-Party Services
          </h2>
          <p className="text-slate-700 dark:text-slate-300 mb-4">
            Our platform may integrate with third-party processors and services:
          </p>
          <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
            <li>
              <strong>Authentication:</strong> Clerk and/or Supabase may process authentication data
            </li>
            <li>
              <strong>Payments:</strong> Stripe processes all payment transactions
            </li>
            <li>
              <strong>Database and hosting:</strong> Supabase, Vercel, Railway or similar providers may
              process application data and operational logs
            </li>
            <li>
              <strong>Analytics and logging:</strong> analytics, error tracking and logging tools may be
              used to understand reliability and product usage where configured
            </li>
            <li>
              <strong>AI Services:</strong> AI providers may process prompts, property context or derived
              summaries for analysis features when enabled
            </li>
          </ul>
          <p className="text-slate-700 dark:text-slate-300 mt-4">
            These services have their own privacy policies, and we encourage you to review them.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            5. Data Security
          </h2>
          <p className="text-slate-700 dark:text-slate-300">
            We implement appropriate technical and organizational measures to protect your personal
            information against unauthorized access, alteration, disclosure, or destruction. However,
            no method of transmission over the internet is 100% secure, and we cannot guarantee
            absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            6. Your Rights
          </h2>
          <p className="text-slate-700 dark:text-slate-300 mb-4">
            Depending on your location, including under UK/GDPR-style data protection laws where
            applicable, you may have the following rights:
          </p>
          <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 ml-4">
            <li>Access your personal information</li>
            <li>Correct inaccurate information</li>
            <li>Request deletion of your information</li>
            <li>Object to or restrict processing</li>
            <li>Data portability</li>
            <li>Withdraw consent</li>
          </ul>
          <p className="text-slate-700 dark:text-slate-300 mt-4">
            To exercise these rights, please contact us at{' '}
            <a href="mailto:privacy@propnexus.com" className="text-brand-600 hover:text-brand-700 dark:text-brand-400">
              privacy@propnexus.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            7. Data Retention
          </h2>
          <p className="text-slate-700 dark:text-slate-300">
            We retain your personal information for as long as necessary to provide our services
            and fulfill the purposes outlined in this policy, unless a longer retention period
            is required by law.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            8. Children&apos;s Privacy
          </h2>
          <p className="text-slate-700 dark:text-slate-300">
            PropNexus is not intended for users under the age of 18. We do not knowingly collect
            personal information from children. If we become aware that we have collected information
            from a child, we will take steps to delete it.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            9. Changes to This Policy
          </h2>
          <p className="text-slate-700 dark:text-slate-300">
            We may update this Privacy Policy from time to time. We will notify you of significant
            changes by email or through a prominent notice on our platform. The &ldquo;Last updated&rdquo;
            date at the top indicates when this policy was last revised.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
            10. Contact Us
          </h2>
          <p className="text-slate-700 dark:text-slate-300">
            If you have questions about this Privacy Policy or our privacy practices, please contact us at:{' '}
            <a href="mailto:privacy@propnexus.com" className="text-brand-600 hover:text-brand-700 dark:text-brand-400">
              privacy@propnexus.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
