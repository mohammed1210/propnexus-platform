'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'

type SavedDeal = {
  id: string
  title?: string | null
  location?: string | null
  created_at?: string | null
}

export default function SavedDealsPage() {
  const [deals, setDeals] = useState<SavedDeal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: wire to Supabase or API if/when ready
    setLoading(false)
  }, [])

  if (loading) return <div className="p-6">Loading your saved deals…</div>

  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Saved Deals</h1>
      {deals.length === 0 ? (
        <p>No saved deals yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {deals.map((d) => (
            <div key={d.id} className="border rounded p-4">
              <div className="font-medium">{d.title ?? 'Deal'}</div>
              <div className="opacity-70 text-sm">{d.location ?? '—'}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
