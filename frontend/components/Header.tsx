"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useState } from "react";
import { Disclosure, Transition } from "@headlessui/react";
import { Bars3Icon, XMarkIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";
import { SafeSignedIn, SafeSignedOut, SafeUserButton } from "./ClerkAuthSafe";
import ThemeToggle from "./ThemeToggle";
import OnboardingTour from "./OnboardingTour";
import { isAuthEnabled } from "@/lib/auth";
import { FF } from "@/lib/flags";

function isListingsRoute(pathname: string | null): boolean {
  const path = String(pathname || '').toLowerCase();
  return /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?listings(?:\/|$)/.test(path);
}

export default function Header() {
  const t = useTranslations("header");
  const pathname = usePathname();
  const links = [
    { href: '/', label: t('nav.home') },
    { href: '/listings', label: t('nav.listings') },
    { href: '/saved', label: t('nav.savedDeals') },
    ...(FF.OFF_MARKET ? [{ href: '/off-market', label: t('nav.offMarket') }] : []),
    { href: '/demo', label: t('nav.demo') },
    { href: '/pricing', label: t('nav.pricing') },
  ];
  const accountLinks = [
    { href: '/account', label: t('account') },
  ];

  const [mobileMenuKey, setMobileMenuKey] = useState(0);
  const [tourRunNonce, setTourRunNonce] = useState(0);
  const [tourSeen, setTourSeen] = useState(true);
  const showTourControls = isListingsRoute(pathname);

  // Close the mobile menu by remounting Disclosure when a link is tapped
  const handleMobileNavigate = () => setMobileMenuKey((k) => k + 1);
  const handleStartTour = () => {
    setTourRunNonce((n) => n + 1);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('propnexus:start-tour'));
    }
  };

  return (
    <header
      className={clsx(
        'sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur-md shadow-sm',
        'border-slate-200 dark:border-slate-700 dark:bg-slate-900/95',
      )}
      role="banner"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-brand-sm">
            <span className="text-white font-bold text-sm">PN</span>
          </div>
          <span className="text-xl font-bold text-slate-900 dark:text-white">{t('brand')}</span>
        </Link>

  {/* Nav */}
        {/* Desktop navigation */}
        <nav className="hidden md:flex items-center gap-2" aria-label="Primary">
          {links.map(({ href, label }) => {
            const active = pathname === href || (href !== '/' && pathname?.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'text-sm font-medium transition-colors duration-300',
                  active
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-400',
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop right side actions */}
        <div className="hidden md:flex items-center gap-3">
          {showTourControls ? (
            <button
              type="button"
              data-testid="header-tour-button"
              className="hidden lg:inline-flex h-10 px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              onClick={handleStartTour}
            >
              {tourSeen ? 'Replay Tour' : 'Start Tour'}
            </button>
          ) : null}
          <ThemeToggle />

          <SafeSignedIn>
            <nav className="flex items-center gap-2" aria-label="Account">
              {accountLinks.map(({ href, label }) => {
                const active = pathname === href || (href !== '/' && pathname?.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={clsx(
                      'text-sm font-medium transition-colors duration-300',
                      active
                        ? 'text-brand-600 dark:text-brand-400'
                        : 'text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-400',
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
              <SafeUserButton afterSignOutUrl="/" />
            </nav>
          </SafeSignedIn>

          <SafeSignedOut>
            {isAuthEnabled ? (
              <>
                <Link
                  href="/sign-in"
                  className="hidden md:inline-flex text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors duration-300"
                >
                  {t('signIn')}
                </Link>
                <Link href="/sign-up" className="btn-primary text-sm px-5 py-2">
                  {t('getStarted')}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="hidden md:inline-flex text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors duration-300"
                >
                  {t('signIn')}
                </Link>
                <Link href="/sign-up" className="btn-primary text-sm px-5 py-2">
                  {t('getStarted')}
                </Link>
              </>
            )}
          </SafeSignedOut>
        </div>

        {/* Mobile right side: Theme + Hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <Disclosure key={mobileMenuKey}>
            {({ open }) => (
              <>
                <Disclosure.Button
                  className="inline-flex items-center justify-center rounded-md p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  aria-label={open ? t('closeMenu') : t('openMenu')}
                >
                  {open ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
                </Disclosure.Button>
                <Transition
                  enter="transition duration-150 ease-out"
                  enterFrom="opacity-0 -translate-y-2"
                  enterTo="opacity-100 translate-y-0"
                  leave="transition duration-150 ease-in"
                  leaveFrom="opacity-100 translate-y-0"
                  leaveTo="opacity-0 -translate-y-2"
                >
                  <Disclosure.Panel className="absolute left-0 right-0 top-[68px] z-40 mx-auto w-full max-w-7xl px-4 md:hidden">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg p-4 space-y-4">
                      {/* Grouped pages dropdown for readability */}
                      <Disclosure as="div" className="border-b border-slate-200 dark:border-slate-800 pb-3">
                        {({ open: pagesOpen }) => (
                          <div>
                            <Disclosure.Button className="flex w-full items-center justify-between text-left text-sm font-medium text-slate-800 dark:text-slate-200">
                              <span>{t('pages')}</span>
                              <ChevronDownIcon className={clsx('h-5 w-5 transition-transform', pagesOpen ? 'rotate-180' : 'rotate-0')} />
                            </Disclosure.Button>
                            <Transition
                              enter="transition duration-150 ease-out"
                              enterFrom="opacity-0 -translate-y-2"
                              enterTo="opacity-100 translate-y-0"
                              leave="transition duration-100 ease-in"
                              leaveFrom="opacity-100 translate-y-0"
                              leaveTo="opacity-0 -translate-y-2"
                            >
                              <Disclosure.Panel className="mt-2 space-y-1">
                                {links.map(({ href, label }) => {
                                  const active = pathname === href || (href !== '/' && pathname?.startsWith(href));
                                  return (
                                    <Link
                                      key={href}
                                      href={href}
                                      onClick={handleMobileNavigate}
                                      className={clsx(
                                        'block rounded-md px-3 py-2 text-sm font-medium transition-all duration-150 transform-gpu hover:translate-x-0.5 active:scale-[0.98]',
                                        active
                                          ? 'bg-blue-50 text-blue-700 dark:bg-slate-800 dark:text-blue-300'
                                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                                      )}
                                    >
                                      {label}
                                    </Link>
                                  );
                                })}
                              </Disclosure.Panel>
                            </Transition>
                          </div>
                        )}
                      </Disclosure>

                      {/* Account / Auth */}
                      <div className="pt-2">
                        {showTourControls ? (
                          <button
                            type="button"
                            data-testid="mobile-tour-button"
                            className="mb-3 w-full rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-100 dark:border-brand-900/60 dark:bg-brand-950/30 dark:text-brand-300 dark:hover:bg-brand-950/50"
                            onClick={() => {
                              handleStartTour();
                              handleMobileNavigate();
                            }}
                          >
                            {tourSeen ? 'Replay Tour' : 'Start Tour'}
                          </button>
                        ) : null}
                        <SafeSignedIn>
                          <div className="flex flex-col gap-3 text-sm">
                            <Link
                              href="/account"
                              onClick={handleMobileNavigate}
                              className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              {t('accountSettings')}
                            </Link>
                            <SafeUserButton
                              afterSignOutUrl="/"
                              appearance={{
                                elements: {
                                  userButtonOuterIdentifier: 'text-sm',
                                },
                              }}
                            />
                          </div>
                        </SafeSignedIn>
                        <SafeSignedOut>
                          <div className="flex flex-col gap-2">
                            {isAuthEnabled ? (
                              <>
                                <Link
                                  href="/sign-in"
                                  onClick={handleMobileNavigate}
                                  className="block rounded-md bg-black px-3 py-2 text-white hover:bg-slate-800 text-sm font-semibold transition-colors text-center"
                                >
                                  {t('signIn')}
                                </Link>
                                <Link
                                  href="/sign-up"
                                  onClick={handleMobileNavigate}
                                  className="block rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-center"
                                >
                                  {t('getStarted')}
                                </Link>
                              </>
                            ) : (
                              <>
                                <Link
                                  href="/sign-in"
                                  onClick={handleMobileNavigate}
                                  className="block rounded-md bg-black px-3 py-2 text-white hover:bg-slate-800 text-sm font-semibold transition-colors"
                                >
                                  {t('signIn')}
                                </Link>
                                <Link
                                  href="/sign-up"
                                  onClick={handleMobileNavigate}
                                  className="block rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                  {t('getStarted')}
                                </Link>
                              </>
                            )}
                          </div>
                        </SafeSignedOut>
                      </div>
                    </div>
                  </Disclosure.Panel>
                </Transition>
              </>
            )}
          </Disclosure>
        </div>
      </div>

      <OnboardingTour runNonce={tourRunNonce} onSeenChange={setTourSeen} />
    </header>
  );
}
