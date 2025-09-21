import Link from "next/link";
import Badge from "@/components/ui/Badge";
import ImageWithFallback from "@/components/ImageWithFallback";

type Prop = {
  id?: string | number | null;
  title?: string | null;
  location?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  yield_percent?: number | null;
  roi_percent?: number | null;
  imageurl?: string | null;
};

export default function PropertyCard({ p }: { p: Prop }) {
  const id = String(p.id ?? "");
  const priceFmt =
    p.price != null ? `£${Number(p.price).toLocaleString()}` : "—";

  async function handleSaveDeal() {
    const sb = getSupabase();
    const { error } = await sb.from('saved_deals').insert([
      {
        property_id: p.id,
        title: p.title,
        location: p.location,
        price: p.price,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        yield_percent: p.yield_percent,
        roi_percent: p.roi_percent,
        imageurl: p.imageurl,
        saved_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error('Error saving deal:', error);
      alert('❌ Failed to save deal');
    } else {
      alert('✅ Deal saved successfully');
    }
  }

  return (
    <article className="card p-3 md:p-4">
      {/* cover */}
      <div className="mb-3">
        <ImageWithFallback
          src={p.imageurl || "/placeholder.png"}
          alt={p.title || "Property"}
          width={1200}
          height={630}
          className="w-full h-48 md:h-52 object-cover rounded-lg"
        />
      </div>

      {/* title + meta */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base md:text-lg font-semibold">
          {p.title || "Untitled property"}
        </h3>
        <div className="flex gap-2">
          {p.yield_percent != null && (
            <Badge color="green">
              Yield {Number(p.yield_percent).toFixed(1)}%
            </Badge>
          )}
          {p.roi_percent != null && (
            <Badge color="indigo">
              ROI {Number(p.roi_percent).toFixed(1)}%
            </Badge>
          )}
        </div>
      </div>

      <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
        {p.location || "—"}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="text-lg font-semibold">{priceFmt}</div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {(p.bedrooms ?? 0)} beds • {(p.bathrooms ?? 0)} baths
        </div>
      </div>

      {/* actions */}
      {id && (
        <div className="mt-3 flex gap-2">
          <Link
            className="btn btn-outline"
            href={`/property/${encodeURIComponent(id)}`}
          >
            View Details
          </Link>
          <button className="btn btn-primary">Save Deal</button>
        </div>
      )}
    </article>
  );
}
