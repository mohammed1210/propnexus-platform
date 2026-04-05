import { buildPdfImageProxyPath, isUnsafePdfImageUrl } from '@/lib/pdfImageProxy';
import type { FinancialLineItem, PropertyDealPackModel } from '@/lib/propertyDealPack';

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

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h3 className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500">{label}</h3>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

function MetricGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{item.label}</dt>
          <dd className="mt-0.5 text-sm font-medium leading-5 text-slate-800 break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function FinancialTable({ items }: { items: FinancialLineItem[] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {items.map((item) => (
          <tr key={item.label} className="border-b border-slate-100 last:border-0">
            <td className="py-1.5 pr-4 text-[11px] font-medium text-slate-500 align-top whitespace-nowrap">{item.label}</td>
            <td className={`py-1.5 text-right text-sm font-semibold align-top break-words ${item.isPlaceholder ? 'text-slate-400 italic' : 'text-slate-900'}`}>
              {item.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function PropertyDealPackTemplate({ model }: TemplateProps) {
  const heroImageSrc = resolveHeroImageSrc(model.imageUrl);
  const summaryContent = model.requiresSecondPage ? model.executiveSummaryPreview : model.executiveSummary;

  const marketStatusBadge =
    model.marketStatus === 'off-market'
      ? { label: 'Off-Market', classes: 'bg-amber-50 border-amber-200 text-amber-800' }
      : model.marketStatus === 'on-market'
      ? { label: 'On-Market', classes: 'bg-emerald-50 border-emerald-200 text-emerald-800' }
      : null;

  return (
    <div data-deal-pack-root className="min-h-screen bg-slate-100 text-slate-950 print:min-h-0 print:bg-white">
      <div className="mx-auto flex w-full max-w-[210mm] flex-col gap-4 px-3 py-4 print:max-w-none print:gap-0 print:px-0 print:py-0">
        {/* ── Page 1 ── */}
        <article
          data-deal-pack-page="primary"
          data-page-count={model.requiresSecondPage ? '2' : '1'}
          className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)] print:rounded-none print:border-0 print:shadow-none"
          style={{ pageBreakInside: 'avoid' }}
        >
          {/* ── Section A — Deal Header ── */}
          <div
            data-deal-pack-banner
            className="bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_32%),linear-gradient(135deg,_#020617,_#0f172a_52%,_#164e63)] px-6 py-5 text-white print:px-6 print:py-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-2xl space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-200/90">{model.brandTitle}</p>
                <p className="text-[13px] font-medium text-white/90">{model.reportTitle}</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-right backdrop-blur">
                <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-sky-100/80">Prepared</div>
                <div className="mt-1 text-[12px] font-medium text-white">{model.exportedAt}</div>
              </div>
            </div>

            <div className="mt-4 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {marketStatusBadge ? (
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${marketStatusBadge.classes}`}>
                    {marketStatusBadge.label}
                  </span>
                ) : null}
                <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/90">
                  {model.investmentType}
                </span>
                <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/90">
                  {model.propertyType}
                </span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white print:text-[22px] max-w-2xl">{model.headline}</h1>
              <p className="text-sm text-slate-300">{model.location}</p>
            </div>
          </div>

          {/* ── Hero image (Section A continued) ── */}
          <section
            data-deal-pack-section="hero"
            data-print-block="keep"
            className="relative overflow-hidden border-b border-slate-200 bg-slate-950"
            style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
          >
            {heroImageSrc ? (
              <div className="relative h-[200px] overflow-hidden bg-slate-900 print:h-[160px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={heroImageSrc} alt={model.headline} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
              </div>
            ) : (
              <div className="flex h-[120px] flex-col justify-between bg-[linear-gradient(135deg,_#0f172a,_#1e293b_48%,_#164e63)] px-6 py-4 print:h-[100px]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-200/90">Listing imagery</p>
                <p className="max-w-sm text-sm leading-5 text-slate-200">
                  Visual unavailable — this deal pack still captures pricing, strategy, and source-level context. Review the live listing for imagery before proceeding.
                </p>
              </div>
            )}
          </section>

          <div className="px-6 py-5 space-y-5 print:px-6 print:py-4">

            {/* ── Section B — Deal Snapshot ── */}
            <section
              aria-label="Deal snapshot"
              data-deal-pack-section="snapshot"
              data-print-block="keep"
              className="space-y-2.5"
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
            >
              <SectionHeader label="Deal Snapshot" />
              <div data-deal-pack-snapshot-grid className="grid gap-2.5 grid-cols-2 sm:grid-cols-4">
                {model.snapshotCards.map((card, index) => {
                  const tones = [
                    'from-sky-950 via-slate-950 to-slate-900 text-white border-sky-900/80',
                    'from-white via-slate-50 to-slate-100 text-slate-950 border-slate-200',
                    'from-emerald-950 via-emerald-900 to-teal-900 text-white border-emerald-800/70',
                    'from-violet-950 via-indigo-950 to-slate-900 text-white border-violet-900/70',
                  ] as const;
                  return (
                    <div
                      key={card.label}
                      data-deal-pack-snapshot-card
                      data-deal-pack-tone={index % tones.length}
                      className={`rounded-2xl border bg-gradient-to-br p-3.5 shadow-sm ${tones[index % tones.length]}`}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] opacity-70">{card.label}</div>
                      <div className="mt-1.5 text-[22px] font-semibold tracking-tight leading-none">{card.value}</div>
                    </div>
                  );
                })}
              </div>
              {model.summarySnapshot.length > 0 && (
                <div data-deal-pack-summary-grid className="grid gap-2 sm:grid-cols-2">
                  {model.summarySnapshot.map((metric) => (
                    <div key={metric.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{metric.label}</div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900">{metric.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Section C — Deal Highlights ── */}
            <section
              data-deal-pack-section="highlights"
              data-print-block="keep"
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
            >
              <SectionHeader label="Deal Highlights" />
              <ul className="space-y-2 text-sm leading-6 text-slate-700">
                {model.highlights.map((highlight) => (
                  <li key={highlight} className="flex gap-2.5">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* ── Sections D + E side-by-side ── */}
            <div className="grid gap-4 lg:grid-cols-2">

              {/* ── Section D — Property Details ── */}
              <section
                data-deal-pack-section="property-details"
                data-print-block="keep"
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
              >
                <SectionHeader label="Property Details" />
                <MetricGrid items={model.propertyDetails} />
              </section>

              {/* ── Section E — Area & Demand ── */}
              <section
                data-deal-pack-section="area-demand"
                data-print-block="keep"
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
              >
                <SectionHeader label="Area &amp; Demand" />
                <MetricGrid items={model.areaDemand} />
              </section>
            </div>

            {/* ── Section F — Financial Breakdown ── */}
            <section
              data-deal-pack-section="financial"
              data-print-block="keep"
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
            >
              <SectionHeader label="Financial Breakdown" />
              <div className="grid gap-4 sm:grid-cols-2">
                <FinancialTable items={model.financialBreakdown.slice(0, Math.ceil(model.financialBreakdown.length / 2))} />
                <FinancialTable items={model.financialBreakdown.slice(Math.ceil(model.financialBreakdown.length / 2))} />
              </div>
            </section>

            {/* ── Section G — Investment Insight ── */}
            <section
              data-deal-pack-section="insight"
              data-print-block="keep"
              className="rounded-2xl border border-sky-100 bg-sky-50 p-4"
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
            >
              <SectionHeader label="Investment Insight" />
              <p className="text-[13px] leading-6 text-slate-700">{model.investmentInsight}</p>
            </section>

            {/* ── Section H — Summary / Underwriting Note ── */}
            <section
              data-deal-pack-section="summary"
              data-print-block="keep"
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
            >
              <SectionHeader label={model.requiresSecondPage ? 'Summary Snapshot' : 'Summary'} />
              <div className="space-y-2 text-[13px] leading-6 text-slate-700">
                {summaryContent.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>

          </div>

          <footer data-deal-pack-footer className="border-t border-slate-200 bg-slate-50 px-6 py-3 print:px-6">
            <div className="flex flex-col gap-1.5 text-[10px] text-slate-500 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <span className="font-semibold text-slate-700">{model.brandTitle}</span> · investor export · {model.exportedAt}
              </div>
              <div className="max-w-[420px] break-words text-right text-slate-500">
                Source: <span className="font-medium text-slate-700">{model.sourceUrlDisplay}</span>
              </div>
            </div>
          </footer>
        </article>

        {/* ── Page 2 (overflow) ── */}
        {model.requiresSecondPage ? (
          <article
            data-deal-pack-page="overflow"
            className="break-before-page overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)] print:rounded-none print:border-0 print:shadow-none"
          >
            <div className="grid gap-4 px-6 py-5 print:px-6 print:py-4">
              <section
                data-print-block="keep"
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
              >
                <SectionHeader label="Executive Summary" />
                <div className="space-y-3 text-[13px] leading-6 text-slate-700">
                  {model.executiveSummary.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
              {model.supportingSections.map((section) => (
                <section
                  key={section.title}
                  data-print-block="keep"
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                >
                  <SectionHeader label={section.title} />
                  <div className="space-y-2 text-[13px] leading-6 text-slate-700">
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
