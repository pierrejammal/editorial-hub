import React from "react";
import { scoreBand, SUB_SCORES } from "@/lib/score";
import { Check, TriangleAlert } from "lucide-react";

export const ScorePanel = ({ scoring }) => {
  if (!scoring) return null;
  const total = scoring.total ?? 0;
  const band = scoreBand(total);
  const R = 52;
  const C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, total)) / 100;

  return (
    <section
      data-testid="score-panel"
      className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm"
    >
      <div className="flex items-center gap-6">
        <div className="relative shrink-0" style={{ width: 128, height: 128 }}>
          <svg width="128" height="128" className="-rotate-90">
            <circle cx="64" cy="64" r={R} fill="none" stroke="#eee6de" strokeWidth="10" />
            <circle
              cx="64"
              cy="64"
              r={R}
              fill="none"
              stroke={band.color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct)}
              style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span data-testid="score-total" className="font-mono text-3xl font-bold text-forsides-ink">
              {total}
            </span>
            <span className="font-mono text-[10px] tracking-widest text-slate-400">/ 100</span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-400">
            Score éditorial
          </div>
          <div
            data-testid="score-classification"
            className="mt-1 font-serif text-2xl font-bold leading-tight"
            style={{ color: band.color }}
          >
            {scoring.classification || band.label}
          </div>
          {scoring.recommendation && (
            <p className="mt-2 text-sm leading-snug text-forsides-slate">{scoring.recommendation}</p>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-2.5">
        {SUB_SCORES.some((s) => scoring[s.key]?.score != null) &&
          SUB_SCORES.map((s) => {
          const val = scoring[s.key]?.score ?? 0;
          return (
            <div key={s.key} data-testid={`subscore-${s.key}`} className="flex items-center gap-3">
              <span className="w-44 shrink-0 text-xs text-forsides-slate">{s.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(val / s.max) * 100}%`,
                    background: band.color,
                    transition: "width 0.9s cubic-bezier(0.22,1,0.36,1)",
                  }}
                />
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-xs font-semibold text-forsides-ink">
                {val}/{s.max}
              </span>
            </div>
          );
        })}
      </div>

      {(scoring.strengths?.length || scoring.weaknesses?.length) && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {scoring.strengths?.length > 0 && (
            <div>
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-emerald-700">
                Points forts
              </div>
              <ul className="space-y-1">
                {scoring.strengths.map((s, i) => (
                  <li key={i} className="flex gap-1.5 text-sm text-forsides-ink">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(scoring.weaknesses?.length > 0 || scoring.vigilance) && (
            <div>
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-700">
                Points de vigilance
              </div>
              <ul className="space-y-1">
                {(scoring.weaknesses || []).map((s, i) => (
                  <li key={i} className="flex gap-1.5 text-sm text-forsides-ink">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span>{s}</span>
                  </li>
                ))}
                {scoring.vigilance && (
                  <li className="flex gap-1.5 text-sm text-forsides-ink">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span>{scoring.vigilance}</span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
