export default function HomeLanding() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-14">
      <h1 className="text-3xl font-bold">PropNexus</h1>
      <p className="text-slate-600 mt-2">Find, analyse and track property deals.</p>
      <div className="mt-6 flex gap-3">
        <a href="/" className="small-button">Browse Listings</a>
        <a href="/analytics" className="small-button" style={{ backgroundColor: '#475569' }}>View Analytics</a>
      </div>
    </main>
  );
}