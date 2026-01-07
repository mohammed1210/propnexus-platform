// Force sign-in page to be dynamic to prevent build-time issues
export const dynamic = 'force-dynamic';

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
