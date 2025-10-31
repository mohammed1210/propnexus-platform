export const metadata = { title: 'Payment Cancelled • PropNexus' };

export default function CancelPage() {
  return (
    <main className="max-w-xl mx-auto py-24 px-6 text-center">
      <h1 className="text-3xl font-semibold mb-4">❌ Payment Cancelled</h1>
      <p className="text-lg mb-6">Your payment was cancelled. You can retry anytime.</p>
      <a className="btn" href="/pricing">Return to Pricing</a>
    </main>
  );
}
