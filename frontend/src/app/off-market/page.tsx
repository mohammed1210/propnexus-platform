export const dynamic = 'force-dynamic'

export default async function OffMarketPage() {
  const data: any[] = []

  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">Off-Market Deals</h1>
      <p className="opacity-75 mb-6">Connect your off-market data source to populate this page.</p>
      {data.length === 0 ? (
        <div className="border rounded p-6">No off-market deals yet.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{/* cards */}</div>
      )}
    </main>
  )
}
