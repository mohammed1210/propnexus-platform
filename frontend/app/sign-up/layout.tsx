// Force sign-up page to be dynamic to prevent build-time issues
export const dynamic = 'force-dynamic';

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
