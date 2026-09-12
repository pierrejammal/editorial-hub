import React from "react";

const ROWS = [
  { key: "fact", label: "Ce qui s'est passé" },
  { key: "what_changes", label: "Ce qui change" },
  { key: "why_important", label: "Pourquoi c'est important" },
  { key: "insight", label: "Insight" },
];

export const AnalysisPanel = ({ editorial, meta, sources }) => {
  if (!editorial) return null;
  return (
    <section
      data-testid="analysis-panel"
      className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-serif text-lg font-bold text-forsides-ink">Analyse éditoriale</h3>
        {editorial.angle && (
          <span
            data-testid="editorial-angle"
            className="rounded-full bg-forsides-red/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-forsides-red"
          >
            {editorial.angle}
          </span>
        )}
      </div>

      {editorial.key_figure && (
        <div className="mb-5 rounded-lg border border-forsides-red/20 bg-forsides-red/5 p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-forsides-red">
            Chiffre clé
          </div>
          <div data-testid="key-figure" className="mt-1 font-serif text-2xl font-bold text-forsides-bordeaux">
            {editorial.key_figure}
          </div>
        </div>
      )}

      <dl className="space-y-4">
        {ROWS.map((r) =>
          editorial[r.key] ? (
            <div key={r.key} data-testid={`analysis-${r.key}`} className="border-l-2 border-slate-200 pl-4">
              <dt className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
                {r.label}
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-forsides-ink">{editorial[r.key]}</dd>
            </div>
          ) : null
        )}
      </dl>

      {sources?.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-400">
            Sources
          </div>
          <ul className="space-y-1">
            {sources.map((s, i) => (
              <li key={i} className="truncate text-sm">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  data-testid={`source-link-${i}`}
                  className="text-forsides-red underline-offset-2 hover:underline"
                >
                  {s.title || s.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
