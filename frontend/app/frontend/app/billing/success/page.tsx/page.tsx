export const metadata = { title: 'Payment Successful \u2022 PropNexus' };

export default function SuccessPage() {
  return (
    <div className="container mx-auto py-24 text-center">
      <h1 className="text-3xl font-semibold mb-4">Payment Successful \uD83C\uDF89</h1>
      <p className="text-lg mb-2">Your subscription is now active.</p>
      <p className="opacity-70 mb-6">You can manage your subscription in your account.</p>
      <a href="/billing/account" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:opacity-90">
        Manage Subscription
      </a>
    </div>
  );
}
export const metadata = { title: 'Payment Successful \u2022 PropNexus' };

export default function SuccessPage() {
  return (
    <div className="container mx-auto py-24 text-center">
      <h1 className="text-3xl font-semibold mb-4">Payment Successful \uD83C\uDF89</h1>
      <p className="text-lg mb-2">Your subscription is now active.</p>
      <p className="opacity-70 mb-6">You can manage your subscription in your account.</p>
      <a href="/billing/account" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:opacity-90">
        Manage Subscription
      </a>
    </div>
  );
}
export const metadata = { title: 'Payment Cancelled • PropNexus' };

export default function CancelPage() {
  return (
    <main className="max-w-2xl mx-auto py-24 text-center">
      <h1 className="text-3xl font-semibold mb-4">❌ Payment Cancelled</h1>
      <p className="text-lg mb-2">Your checkout session was cancelled.</p>
      <p className="opacity-70">
        You can return to the pricing page anytime to complete your upgrade.
      </p>
      <a
        href="/pricing"
        className="inline-block mt-6 bg-black text-white px-6 py-3 rounded-md hover:opacity-90"
      >
        Back to Pricing
      </a>
    </main>
  )}
