'use client';

import { useEffect, useState } from 'react';

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
  showOrbs?: boolean;
}

export default function PageWrapper({ children, className = '', showOrbs = true }: PageWrapperProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={`page-wrapper ${className}`}>
      {/* Floating orbs for visual interest */}
      {showOrbs && mounted && (
        <div className="page-orbs" aria-hidden="true">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
        </div>
      )}

      {children}
    </div>
  );
}
