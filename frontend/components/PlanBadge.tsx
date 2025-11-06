// frontend/components/PlanBadge.tsx
/**
 * Display user's current plan as a badge
 */
'use client';

import { useUserPlan } from '@/lib/useUserPlan';

interface PlanBadgeProps {
  className?: string;
}

/**
 * PlanBadge - Shows the user's current plan
 */
export default function PlanBadge({ className = '' }: PlanBadgeProps) {
  const { data, loading } = useUserPlan();

  if (loading) {
    return (
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 ${className}`}>
        Loading...
      </div>
    );
  }

  const plan = data?.plan || 'free';
  
  const badgeStyles = {
    free: 'bg-slate-100 text-slate-700',
    pro: 'bg-blue-100 text-blue-700',
    enterprise: 'bg-purple-100 text-purple-700',
  };

  const badgeIcons = {
    free: '🆓',
    pro: '⭐',
    enterprise: '👑',
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${badgeStyles[plan]} ${className}`}>
      <span>{badgeIcons[plan]}</span>
      <span className="capitalize">{plan}</span>
    </div>
  );
}
