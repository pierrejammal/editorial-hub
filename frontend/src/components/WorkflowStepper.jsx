import React from "react";
import { Check } from "lucide-react";

export const STEPS = ["Source", "Analyse", "Score", "Angle", "Caption", "Visual"];

export const WorkflowStepper = ({ active = 6, compact = false }) => {
  return (
    <div data-testid="workflow-stepper" className="flex items-center gap-1.5">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < active;
        const current = n === active;
        return (
          <React.Fragment key={label}>
            <div className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold transition-colors ${
                  done
                    ? "bg-forsides-ink text-white"
                    : current
                    ? "bg-forsides-red text-white"
                    : "bg-white text-slate-400 ring-1 ring-slate-200"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : n}
              </span>
              {!compact && (
                <span
                  className={`text-xs font-semibold uppercase tracking-[0.14em] ${
                    current ? "text-forsides-red" : done ? "text-forsides-ink" : "text-slate-400"
                  }`}
                >
                  {label}
                </span>
              )}
            </div>
            {n < STEPS.length && (
              <span className="h-px w-4 shrink-0 bg-slate-300 sm:w-6" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
