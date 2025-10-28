export const metadata = { title: 'Checkout • PropNexus' };

export default function CheckoutPage() {
  return (
    <main className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-medium mb-2">Preparing Checkout...</h1>
        <p className="opacity-70">Please wait while we redirect you to Stripe.</p>
      </div>
    </main>
  );
}
