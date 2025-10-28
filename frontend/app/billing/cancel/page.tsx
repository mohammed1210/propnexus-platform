export default function CancelPage() {
  return (
    <div className="container mx-auto p-12 text-center">
      <h1 className="text-3xl font-bold text-red-500">Payment Cancelled ❌</h1>
      <p className="mt-4 text-lg">Your payment was cancelled. You can retry anytime.</p>
      <a href="/pricing" className="btn mt-6 bg-blue-600 text-white px-4 py-2 rounded">
        Return to Pricing
      </a>
    </div>
  );
}
