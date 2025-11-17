'use client';

import { useState, ReactNode } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

interface CollapsibleCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

export default function CollapsibleCard({
  title,
  icon,
  children,
  defaultExpanded = true,
  className = '',
}: CollapsibleCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`card ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? `Collapse ${title}` : `Expand ${title}`}
      >
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          {icon}
          {title}
        </h2>
        <div className="text-slate-600 dark:text-slate-400">
          {isExpanded ? (
            <FiChevronUp className="w-6 h-6" />
          ) : (
            <FiChevronDown className="w-6 h-6" />
          )}
        </div>
      </button>
      
      {isExpanded && (
        <div className="animate-slide-down">
          {children}
        </div>
      )}
    </div>
  );
}
