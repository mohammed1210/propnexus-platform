import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
              PropNexus
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              AI-powered property sourcing and investment analysis platform.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Product
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/listings"
                  className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
                >
                  Property Listings
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
                >
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  href="/saved"
                  className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
                >
                  Saved Deals
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Company
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="mailto:support@propnexus.com"
                  className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
                >
                  Contact
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/mohammed1210/propnexus-platform"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Legal
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/terms"
                  className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/cookies"
                  className="text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
                >
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            © {currentYear} PropNexus. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
