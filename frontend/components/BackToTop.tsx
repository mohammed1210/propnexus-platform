'use client';

import { useEffect, useState } from 'react';

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-6 right-6 z-[9999] rounded-full bg-blue-600 text-white
                 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-400
                 w-11 h-11 shadow-lg transition-transform hover:-translate-y-[2px]"
      aria-label="Back to top"
    >
      ↑
    </button>
  );
}
