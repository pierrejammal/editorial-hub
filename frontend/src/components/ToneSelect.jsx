import React from "react";
import { TONES } from "@/lib/tone";

export const ToneSelect = ({ value, onChange, compact = false, testid = "tone-select" }) => (
  <div data-testid={testid}>
    {!compact && (
      <label className="font-mono text-[10px] uppercase tracking-widest text-slate-400">Ton du post</label>
    )}
    <div className={`flex flex-wrap gap-1.5 ${compact ? "" : "mt-1.5"}`}>
      {TONES.map((t) => (
        <button
          key={t.key || "default"}
          type="button"
          title={t.hint}
          data-testid={`${testid}-${t.key || "default"}`}
          onClick={() => onChange(t.key)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            value === t.key ? "bg-forsides-red text-white" : "bg-slate-100 text-forsides-slate hover:bg-slate-200"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  </div>
);
