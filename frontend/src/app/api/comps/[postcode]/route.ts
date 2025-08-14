import { NextRequest, NextResponse } from "next/server";

type Comp = {
  address: string;
  price: number;
  date?: string;
  type?: string;
  distance_km?: number;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { postcode?: string } }
) {
  try {
    const raw = (params?.postcode || "").toString();
    const pc = raw.trim().toUpperCase();
    if (!pc) {
      return NextResponse.json({ error: "postcode required" }, { status: 400 });
    }

    const backend = (process.env.NEXT_PUBLIC_BACKEND_URL || "").trim();
    if (backend) {
      try {
        const res = await fetch(`${backend}/comps/${encodeURIComponent(pc)}`, {
          headers: { "Content-Type": "application/json" },
          // Avoid caching comps during development
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          return NextResponse.json({ ...data, source: "backend" });
        }
      } catch {
        // fall through to local mock
      }
    }

    // Fallback mock data (keeps UI alive)
    const sales: Comp[] = [
      { address: "12 Sample Rd", price: 445000, date: "2024-11-18", type: "Terraced", distance_km: 0.4 },
      { address: "8 Mason St", price: 462000, date: "2025-02-07", type: "Semi",     distance_km: 0.7 },
      { address: "21 Brook Ave", price: 439000, date: "2025-03-15", type: "Flat",     distance_km: 0.9 },
    ];
    const rents: Comp[] = [
      { address: "42 King Way", price: 1450, date: "2025-06-01", type: "2‑bed", distance_km: 0.6 },
      { address: "18 Vale Cl",  price: 1525, date: "2025-05-12", type: "2‑bed", distance_km: 0.8 },
      { address: "1 Park Ct",   price: 1400, date: "2025-04-20", type: "2‑bed", distance_km: 0.5 },
    ];

    return NextResponse.json({ sales, rents, source: "mock" });
  } catch (e) {
    console.error("comps route error", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
