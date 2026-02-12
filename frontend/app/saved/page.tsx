import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';
import SavedDealsView from '@/components/SavedDeals/SavedDealsView';

export const dynamic = 'force-dynamic';

export default function SavedPage() {
  return (
    <div>
      <SignedOut>
        <div className="p-6">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Saved Deals</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Sign in to view your saved deals.
          </p>
          <div className="mt-4">
            <SignInButton mode="modal" forceRedirectUrl="/saved" signUpForceRedirectUrl="/saved">
              <button className="btn-primary px-5 py-2 inline-flex">Sign in</button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <SavedDealsView />
      </SignedIn>
    </div>
  );
}
