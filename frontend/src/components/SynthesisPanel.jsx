import React from "react";

// Multi-link analysis: how the sources connect, and what each one brings
export const SynthesisPanel = ({ synthesis, sources = [] }) => {
  const s = synthesis || {};
  const per = Array.isArray(s.per_source) ? s.per_source : [];
  return (
    <div data-testid="synthesis-panel" className="space-y-4 text-sm">
      {s.relation && (
        <p>
          <span className="rounded-full bg-forsides-red px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
            {s.relation}
          </span>
        </p>
      )}
      {s.explanation && <p className="leading-relaxed text-forsides-ink">{s.explanation}</p>}
      {per.length > 0 && (
        <ul className="space-y-2.5">
          {per.map((p, i) => {
            const src = sources[i];
            return (
              <li key={i} className="rounded-lg bg-forsides-cream px-3.5 py-2.5 ring-1 ring-slate-200">
                <p className="font-semibold text-forsides-ink">
                  {src?.url ? (
                    <a href={src.url} target="_blank" rel="noopener noreferrer" className="hover:text-forsides-red">
                      {p.source || src.title} ↗
                    </a>
                  ) : p.source}
                </p>
                {p.apport && <p className="mt-0.5 text-forsides-slate">{p.apport}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
