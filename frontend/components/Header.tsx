"use client";

import Link from "next/link";
import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>PropNexus</div>
      <nav className={styles.nav}>
        <Link href="#">For Investors</Link>
        <Link href="#">For Managers</Link>
        <Link href="#">For Deal Sourcers</Link>
        <Link href="#">For SA</Link>
        <Link href="#">Pricing</Link>
        <button className={styles.cta}>Start Free Trial</button>
      </nav>
    </header>
  );
}