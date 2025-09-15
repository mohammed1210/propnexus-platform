import { ReactNode, useState } from 'react';

export default function SafeSection({ children, fallback }: {
  children: (onError: (e: unknown)=>void) => ReactNode;
  fallback?: ReactNode;
}) {
  const [err, setErr] = useState<unknown>(null);
  if (err) return <>{fallback ?? null}</>;
  return <>{children(setErr)}</>;
}
