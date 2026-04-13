'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { FF } from '@/lib/flags';

const links = [
  { href: '/listings', label: 'Listings' },
  { href: '/saved', label: 'Saved Deals' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/pricing', label: 'Pricing' },
];

if (FF.OFF_MARKET) {
  links.splice(1, 0, { href: '/off-market', label: 'Off-Market' });
}

export default function HeaderClient() {
  const pathname = usePathname();

  return (
    <nav className="ml-auto flex items-center gap-2">
      {links.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={[
              'px-3 py-2 rounded-md text-sm transition-colors',
              active
                ? 'font-medium text-zinc-900 dark:text-zinc-100 border-b-2 border-indigo-500'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white',
            ].join(' ')}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
