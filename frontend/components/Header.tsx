'use client';

import Link from 'next/link';
import styles from './Header.module.css';

export default function Header() {
  return (
    <header className={styles.header} role="banner">
      {/* Brand now routes home */}
      <Link href="/" className={styles.logo} aria-label="PropNexus — Home">
        PropNexus
      </Link>

      {/* Keep your existing action buttons */}
      <nav className={styles.nav} aria-label="Primary">
        <button type="button" className={styles.button}>Search</button>
        <button type="button" className={styles.button}>Filters</button>
        <button type="button" className={styles.button}>Map / List</button>
      </nav>
    </header>
  );
}
