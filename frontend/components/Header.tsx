"use client";

import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <h1 className={styles.logo}>PropNexus</h1>
      <nav className={styles.nav}>
        <button className={styles.button}>Search</button>
        <button className={styles.button}>Filters</button>
        <button className={styles.button}>Map / List</button>
      </nav>
    </header>
  );
}
