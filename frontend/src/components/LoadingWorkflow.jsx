import React, { useEffect, useState } from "react";
import { STEPS } from "./WorkflowStepper";

const PHASES = [
  "Récupération de la source…",
  "Analyse éditoriale du contenu…",
  "Scoring sur 100 critères pondérés…",
  "Sélection de l'angle éditorial…",
  "Rédaction du caption LinkedIn…",
  "Contrôle qualité éditorial…",
];

export const LoadingWorkflow = ({ label = "Chaîne éditoriale en cours" }) => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s < PHASES.length - 1 ? s + 1 : s)), 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      data-testid="loading-workflow"
      className="fixed inset-0 z-50 flex items-center justify-center bg-forsides-cream/95 backdrop-blur-sm"
    >
      <div className="w-full max-w-md px-8">
        <div className="mb-8 text-center">
          <span className="news-flag inline-block rounded-sm px-3 py-1 text-2xl">NEWS</span>
          <h3 className="mt-5 font-serif text-2xl font-bold text-forsides-ink">{label}</h3>
          <p className="mt-1 text-sm text-forsides-slate">
            Un professionnel de la veille travaille sur votre publication.
          </p>
        </div>
        <div className="space-y-3">
          {PHASES.map((p, i) => (
            <div
              key={p}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-all duration-500 ${
                i === step
                  ? "border-forsides-red/40 bg-white shadow-sm"
                  : i < step
                  ? "border-transparent bg-transparent opacity-50"
                  : "border-transparent bg-transparent opacity-30"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] font-bold ${
                  i < step ? "bg-forsides-ink text-white" : i === step ? "bg-forsides-red text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                {STEPS[i]?.[0] || i + 1}
              </span>
              <span className={`text-sm ${i === step ? "font-semibold text-forsides-ink" : "text-forsides-slate"}`}>
                {p}
              </span>
              {i === step && (
                <span className="ml-auto flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="h-1.5 w-1.5 animate-pulse rounded-full bg-forsides-red"
                      style={{ animationDelay: `${d * 0.2}s` }}
                    />
                  ))}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
