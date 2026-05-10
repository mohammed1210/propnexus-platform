import type { InvestmentDescriptionOutput } from '@/lib/propertyDescription';

type PropertyDescriptionProps = {
  brief: InvestmentDescriptionOutput;
};

export default function PropertyDescription({ brief }: PropertyDescriptionProps) {
  if (!brief.paragraph) return null;

  const cards = brief.cards.slice(0, 3);
  const checks = brief.checks.slice(0, 3);
  const chips = brief.keySignals.slice(0, 4);

  return (
    <section className="border-t border-slate-200 bg-gradient-to-br from-white via-slate-50/70 to-brand-50/30 p-5 dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-brand-950/20 sm:p-6">
      <div className="space-y-4">
        <div className="max-w-3xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
            Investor Brief
          </div>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            AI-generated summary using the listing, deal score and available market evidence.
          </p>
          <p
            data-testid="investor-brief-paragraph"
            className="mt-3 line-clamp-4 text-[15px] leading-7 text-slate-800 dark:text-slate-200"
          >
            {brief.paragraph}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3" data-testid="investor-brief-cards">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/45"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {card.title}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{card.value}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{card.text}</p>
              {card.title === 'Check before offer' && checks.length > 0 ? (
                <ul aria-label="Checks before offer" className="mt-2 space-y-1.5">
                  {checks.map((check) => (
                    <li key={check} className="flex gap-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                      <span>{check}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>

        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-2" aria-label="Investor brief feature tags">
            {chips.map((signal) => (
              <span
                key={signal}
                data-testid="investor-brief-chip"
                className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-950/45 dark:text-slate-300"
              >
                {signal}
              </span>
            ))}
          </div>
        ) : null}

        {brief.originalNotes ? (
          <details className="rounded-2xl border border-slate-200 bg-white/50 p-3 dark:border-slate-800 dark:bg-slate-950/25">
            <summary className="cursor-pointer text-xs font-medium text-slate-500 marker:text-slate-400 dark:text-slate-400">
              Original listing notes from source
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{brief.originalNotes}</p>
          </details>
        ) : null}
      </div>
    </section>
  );
}
