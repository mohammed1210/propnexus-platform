'use client';

import { useRouter } from 'next/navigation';
import { isAuthEnabled } from '@/lib/auth';

type Props = {
  children?: React.ReactNode;
  className?: string;
};

export default function StartFreeButton({ children = 'Start Free', className }: Props) {
  const router = useRouter();
  const clerk =
    isAuthEnabled && typeof window !== 'undefined'
      ? ((window as any).Clerk as undefined | { loaded?: boolean; user?: any })
      : undefined;

  const isLoaded = !isAuthEnabled || !!clerk?.loaded;
  const user = isAuthEnabled ? clerk?.user ?? null : null;

  const handleClick = () => {
    if (!isLoaded) return;
    router.push(user ? '/listings' : '/sign-up?redirect_url=/listings');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isLoaded}
      className={className ?? 'btn-secondary w-full'}
    >
      {children}
    </button>
  );
}
