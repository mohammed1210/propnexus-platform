import { buildPdfImageProxyPath, isUnsafePdfImageUrl } from '@/lib/pdfImageProxy';
import type { PropertyDealPackModel } from '@/lib/propertyDealPack';

const cardToneClasses = [
  'from-sky-950 via-slate-950 to-slate-900 text-white border-sky-900/80',
  'from-white via-slate-50 to-slate-100 text-slate-950 border-slate-200',
  'from-emerald-950 via-emerald-900 to-teal-900 text-white border-emerald-800/70',
  'from-violet-950 via-indigo-950 to-slate-900 text-white border-violet-900/70',
] as const;

const resolveHeroImageSrc = (imageUrl?: string): string | null => {
  if (!imageUrl) return null;

  try {
    const parsed = new URL(imageUrl);
    if (isUnsafePdfImageUrl(parsed)) return null;
    return buildPdfImageProxyPath(parsed.toString()) || parsed.toString();
  } catch {
    return null;
  }
};

type TemplateProps = {
  model: PropertyDealPackModel;
};

export default function PropertyDealPackTemplate({ model }: TemplateProps) {
  const heroImageSrc = resolveHeroImageSrc(model.imageUrl);
  const executiveSummaryPreview = model.requiresSecondPage ? model.executiveSummaryPreview : model.executiveSummary;

  return (
    <div data-deal-pack-root className="min-h-screen bg-slate-100 text-slate-950 print:bg-white">
      <div className="mx-auto flex w-full max-w-[210mm] flex-col gap-6 px-4 py-6 print:max-w-none print:px-0 print:py-0">
        <article
          data-page-count={model.requiresSecondPage ? '2' : '1'}
          className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)] print:rounded-none print:border-0 print:shadow-none"
        >
          <div className="bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_32%),linear-gradient(135deg,_#020617,_#0f172a_52%,_#164e63)] px-8 py-8 text-white print:px-10 print:py-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="max-w-2xl space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-200/90">{model.brandTitle}</p>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-white print:text-[30px]">{model.reportTitle}</h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-200">{model.reportSubtitle}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/8 px-4 py-3 text-right backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.3em] text-sky-100/80">Prepared</div>
                <div className="mt-2 text-sm font-medium text-white">{model.exportedAt}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-8 px-8 py-8 print:grid-cols-[1.1fr_0.9fr] print:px-10 print:py-8 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-6">
              <div className="space-y-4">
                <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-800">
                  Premium deal pack
                </div>
                <div>
                  <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 print:text-[28px]">
                    {model.headline}
                  </h2>
                  <p className="mt-2 text-base text-slate-600">{model.location}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {model.metadataChips.map((chip) => (
                    <span
                      key={chip.label}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
                    >
                      <span className="mr-2 text-slate-400">{chip.label}</span>
                      <span className="text-slate-800">{chip.value}</span>
                    </span>
                  ))}
                </div>
              </div>

              <section aria-label="Deal snapshot" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Deal Snapshot</h3>
                  <div className="h-px flex-1 bg-slate-200 ml-4" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {model.snapshotCards.map((card, index) => (
                    <div
                      key={card.label}
                      className={`rounded-3xl border bg-gradient-to-br p-5 shadow-sm ${cardToneClasses[index % cardToneClasses.length]}`}
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] opacity-75">{card.label}</div>
                      <div className="mt-3 text-3xl font-semibold tracking-tight">{card.value}</div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {model.summarySnapshot.map((metric) => (
                    <div key={metric.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{metric.label}</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">{metric.value}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Deal Highlights</h3>
                    <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                      Curated
                    </span>
                  </div>
                  <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
                    {model.highlights.map((highlight) => (
                      <li key={highlight} className="flex gap-3">
                        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500" />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Investment Insight</h3>
                  <p className="mt-4 text-[15px] leading-7 text-slate-700">{model.investmentInsight}</p>
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">
                  {model.requiresSecondPage ? 'Summary Snapshot' : 'Executive Summary'}
                </h3>
                <div className="mt-4 space-y-3 text-[15px] leading-7 text-slate-700">
                  {executiveSummaryPreview.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            </section>

            <aside className="space-y-6">
              <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-slate-950 text-white shadow-[0_20px_60px_rgba(15,23,42,0.16)]">
                {heroImageSrc ? (
                  <div className="relative h-[280px] overflow-hidden bg-slate-900 print:h-[260px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={heroImageSrc}
                      alt={model.headline}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/15 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200/90">Hero Image</div>
                      <div className="mt-2 text-sm text-slate-100">Live listing imagery pulled into the export template.</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-[280px] flex-col justify-between bg-[linear-gradient(135deg,_#0f172a,_#1e293b_48%,_#164e63)] p-6 print:h-[260px]">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200/90">Listing imagery</div>
                      <h3 className="mt-4 text-2xl font-semibold text-white">Visual unavailable</h3>
                    </div>
                    <p className="max-w-sm text-sm leading-6 text-slate-200">
                      This deal pack still captures pricing, strategy, and source-level context. Review the live listing for room-by-room imagery before proceeding.
                    </p>
                  </div>
                )}
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Asset Overview</h3>
                <dl className="mt-5 grid gap-4">
                  {model.assetOverview.map((metric) => (
                    <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{metric.label}</dt>
                      <dd className="mt-1 text-sm font-medium leading-6 text-slate-800 break-words">{metric.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </aside>
          </div>

          <footer className="border-t border-slate-200 bg-slate-50 px-8 py-5 print:px-10">
            <div className="flex flex-col gap-3 text-xs text-slate-500 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <span className="font-semibold text-slate-700">{model.brandTitle}</span> investor export · generated {model.exportedAt}
              </div>
              <div className="max-w-[420px] break-words text-right text-slate-500">
                Source reference: <span className="font-medium text-slate-700">{model.sourceUrlDisplay}</span>
              </div>
            </div>
          </footer>
        </article>

        {model.requiresSecondPage ? (
          <article className="break-before-page overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)] print:rounded-none print:border-0 print:shadow-none">
            <div className="grid gap-6 px-8 py-8 print:px-10 print:py-8">
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Executive Summary</h3>
                <div className="mt-4 space-y-4 text-[15px] leading-7 text-slate-700">
                  {model.executiveSummary.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
              {model.supportingSections.map((section) => (
                <section key={section.title} className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">{section.title}</h3>
                  <div className="mt-4 space-y-3 text-[15px] leading-7 text-slate-700">
                    {section.body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
