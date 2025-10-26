export default function SuccessPage() {
  return (
    <div className="container mx-auto p-12 text-center">
      <h1 className="text-3xl font-bold text-green-500">Payment Successful 🎉</h1>
      <p className="mt-4 text-lg">Your PropNexus Pro subscription is now active.</p>
      <a href="/listings" className="btn mt-6 bg-blue-600 text-white px-4 py-2 rounded">
        Browse Deals
      </a>
    </div>
  );
}
