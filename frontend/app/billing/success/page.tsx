export const metadata = { title: 'Payment Successful • PropNexus' };

export default function SuccessPage() {
  return (
    <main className="max-w-2xl mx-auto py-24 px-6 text-center">
      <h1 className="text-3xl font-semibold mb-4">✅ Payment Successful</h1>
      <p className="text-lg mb-2">A sign-in link has been sent to your email.</p>
      <p className="opacity-70">Please check your inbox and follow the link to log in to your premium PropNexus account.</p>
      <div className="mt-8">
        <a className="btn" href="/billing/account">Manage Subscription</a>
      </div>
    </main>
  );
}
