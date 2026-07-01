import { auth, clerkClient } from '@clerk/nextjs/server';

import { getEntitlements, getPlanFromUser, type BackendUserPlan, type DealDeskEntitlements } from '@/lib/entitlements';
import { backendFetch } from '@/lib/server/propertyData';

function isClerkServerEnabled(): boolean {
  const pk = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '').trim();
  const sk = (process.env.CLERK_SECRET_KEY ?? '').trim();
  const disable = ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_DISABLE_AUTH ?? '').trim().toLowerCase(),
  );
  return !disable && pk.startsWith('pk_') && Boolean(sk);
}

function getEmailFromSessionClaims(claims: unknown): string | null {
  if (!claims || typeof claims !== 'object') return null;

  for (const key of ['email', 'email_address', 'primary_email_address'] as const) {
    const value = (claims as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.includes('@')) {
      return value;
    }
  }

  return null;
}

export async function getOptionalSignedInEmail(): Promise<string | null> {
  if (!isClerkServerEnabled()) return null;

  const session: any = await auth();
  const claimEmail = getEmailFromSessionClaims(session?.sessionClaims);
  if (claimEmail) return claimEmail;

  const userId = (session?.userId as string | null) ?? null;
  if (!userId) return null;

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return user.primaryEmailAddress?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? null;
}

export async function getServerUserPlan(): Promise<BackendUserPlan> {
  try {
    const email = await getOptionalSignedInEmail();
    if (!email) return 'free';

    const res = await backendFetch(`/users/plan?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: { 'content-type': 'application/json' },
    });

    if (!res.ok) return 'free';
    const payload = (await res.json().catch(() => null)) as { plan?: unknown } | null;
    return getPlanFromUser(payload);
  } catch {
    return 'free';
  }
}

export async function getServerEntitlements(): Promise<DealDeskEntitlements> {
  return getEntitlements(await getServerUserPlan());
}
