import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";

// Each workflow gets its own steps, matching what the server really does.
// `secs` = roughly when that step starts (based on typical durations), so the
// screen keeps moving for the whole wait instead of freezing on the last step.
const MODES = {
  search: {
    title: "Veille en cours",
    subtitle: "Recherche et sélection des sujets les plus pertinents",
    expected: 45,
    steps: [
      { label: "Recherche des actualités récentes", secs: 0 },
      { label: "Collecte des articles et des sources", secs: 4 },
      { label: "Suppression des doublons", secs: 12 },
      { label: "Filtrage des sources peu fiables", secs: 20 },
      { label: "Notation de chaque sujet sur 100", secs: 28 },
      { label: "Classement des meilleurs sujets", secs: 38 },
    ],
  },
  generate: {
    title: "Création de votre post",
    subtitle: "Rédaction du post LinkedIn à partir du sujet choisi",
    expected: 50,
    steps: [
      { label: "Ouverture et lecture de l'article complet", secs: 0 },
      { label: "Analyse : faits, chiffres, enjeux réglementaires", secs: 10 },
      { label: "Évaluation détaillée du potentiel (/100)", secs: 19 },
      { label: "Choix de l'angle éditorial", secs: 26 },
      { label: "Rédaction du texte LinkedIn", secs: 32 },
      { label: "Contrôle qualité et préparation du visuel", secs: 42 },
    ],
  },
  analyze: {
    title: "Analyse de l'article",
    subtitle: "Lecture du lien et création du post LinkedIn",
    expected: 45,
    steps: [
      { label: "Ouverture et lecture de l'article", secs: 0 },
      { label: "Extraction des faits, chiffres et dates", secs: 8 },
      { label: "Évaluation détaillée du potentiel (/100)", secs: 17 },
      { label: "Choix de l'angle éditorial", secs: 24 },
      { label: "Rédaction du texte LinkedIn", secs: 30 },
      { label: "Contrôle qualité et préparation du visuel", secs: 39 },
    ],
  },
};

export const LoadingWorkflow = ({ mode = "analyze", label, topic }) => {
  const cfg = MODES[mode] || MODES.analyze;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setElapsed((Date.now() - start) / 1000), 250);
    return () => clearInterval(t);
  }, []);

  let step = 0;
  cfg.steps.forEach((s, i) => {
    if (elapsed >= s.secs) step = i;
  });
  const overtime = elapsed > cfg.expected;
  // Smooth bar that approaches 95% near the expected time and never reaches 100% before the end.
  const pct = Math.min(95, (elapsed / cfg.expected) * 90 + (overtime ? Math.min(5, (elapsed - cfg.expected) / 6) : 0));
  const secs = Math.floor(elapsed);

  return (
    <div
      data-testid="loading-workflow"
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-forsides-cream/95 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="news-flag inline-block rounded-sm px-3 py-1 text-2xl">NEWS</span>
          <h3 className="mt-5 font-serif text-2xl font-bold text-forsides-ink">{label || cfg.title}</h3>
          <p className="mt-1 text-sm text-forsides-slate">{cfg.subtitle}</p>
        </div>

        {topic?.title && (
          <div
            data-testid="loading-topic"
            className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-forsides-red">
              Sujet choisi
            </p>
            <p className="mt-1 line-clamp-3 font-serif text-base font-bold leading-snug text-forsides-ink">
              {topic.title}
            </p>
            {(topic.source || topic.score != null) && (
              <p className="mt-1.5 font-mono text-[11px] text-slate-400">
                {topic.source}
                {topic.source && topic.score != null && " · "}
                {topic.score != null && `${topic.score}/100`}
              </p>
            )}
          </div>
        )}

        <div className="mb-5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-forsides-red transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[11px] text-slate-400">
            <span>{secs} s</span>
            <span>
              {overtime ? "Presque terminé, merci de patienter…" : `Environ ${cfg.expected} s au total`}
            </span>
          </div>
        </div>

        <ol className="space-y-2">
          {cfg.steps.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li
                key={s.label}
                className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 transition-all duration-500 ${
                  current
                    ? "border-forsides-red/40 bg-white shadow-sm"
                    : done
                    ? "border-transparent opacity-70"
                    : "border-transparent opacity-35"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold ${
                    done
                      ? "bg-forsides-ink text-white"
                      : current
                      ? "bg-forsides-red text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={`text-sm ${current ? "font-semibold text-forsides-ink" : "text-forsides-slate"}`}>
                  {s.label}
                </span>
                {current && (
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
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};
