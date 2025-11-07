import Image from "next/image";
import Link from "next/link";

export default function HeroImageFill() {
  return (
    <section
      aria-label="AI Deal Sourcing — PropNexus"
      className="relative min-h-[480px] md:min-h-[560px] rounded-2xl overflow-hidden"
    >
      <Image
        src="/branding/hero_deal-sourcing.webp?v=3"
        alt="Agents reviewing top-scored property deals with AI assistant"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />

      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-950/40 to-transparent" />
      <div
        className="absolute inset-0 mix-blend-soft-light opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(900px 380px at 15% 25%, rgba(59,130,246,0.20), transparent)," +
            "radial-gradient(700px 520px at 85% 65%, rgba(16,185,129,0.18), transparent)",
        }}
      />
      <div
        className="absolute inset-0 opacity-20"
        style={{ backgroundImage: "url('/branding/overlays/dots.svg')" }}
      />

      <div className="relative z-10 p-6 md:p-10 max-w-7xl mx-auto">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/70 ring-1 ring-white/10 px-3 py-1 text-xs text-slate-200 backdrop-blur">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            AI Assistant for Investors
          </span>
          <h1 className="mt-4 text-3xl md:text-5xl font-semibold leading-tight text-white">
            Source property deals faster with an AI assistant that scans, scores, and underwrites
          </h1>
          <p className="mt-4 md:mt-6 text-slate-200/90 md:text-lg">
            PropNexus analyzes listings, agent notes, and comps. Get instant viability scores, risk flags, and ready-to-share summaries.
          </p>
          <div className="mt-6 md:mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2.5 font-medium text-white shadow hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Try AI Deal Sourcing
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center rounded-lg bg-white/10 px-4 py-2.5 font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
            >
              Watch a 2-min demo
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
