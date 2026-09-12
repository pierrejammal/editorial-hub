import React from "react";
import { priorityMeta } from "@/lib/score";
import { ExternalLink, Sparkles, X } from "lucide-react";

export const TopicCard = ({ topic, onGenerate, onIgnore, index }) => {
  const pm = priorityMeta(topic.priority);
  return (
    <article
      data-testid={`topic-card-${index}`}
      className="hover-lift rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center">
          <div
            className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg text-white"
            style={{ background: pm.color }}
          >
            <span className="font-mono text-lg font-bold leading-none">{topic.score}</span>
            <span className="font-mono text-[8px] opacity-80">/100</span>
          </div>
          {pm.medal && <span className="mt-1 text-lg">{pm.medal}</span>}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-white"
              style={{ background: pm.color }}
            >
              {topic.priority}
            </span>
            {topic.source && (
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                {topic.source}
              </span>
            )}
            {topic.date && <span className="text-[11px] text-slate-400">· {topic.date}</span>}
          </div>

          <h3 className="mt-2 font-serif text-lg font-bold leading-snug text-forsides-ink">
            {topic.title}
          </h3>
          {topic.summary && (
            <p className="mt-1.5 text-sm leading-relaxed text-forsides-slate">{topic.summary}</p>
          )}

          {topic.why_attention && (
            <div className="mt-3 rounded-lg bg-forsides-cream p-3">
              <div className="font-mono text-[9px] uppercase tracking-widest text-slate-400">
                Pourquoi ce sujet
              </div>
              <p className="mt-0.5 text-sm text-forsides-ink">{topic.why_attention}</p>
            </div>
          )}
          {topic.main_insight && (
            <p className="mt-2 text-sm italic text-forsides-bordeaux">💡 {topic.main_insight}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              data-testid={`topic-generate-${index}`}
              onClick={() => onGenerate(topic)}
              className="inline-flex items-center gap-1.5 rounded-full bg-forsides-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-forsides-bordeaux"
            >
              <Sparkles className="h-3.5 w-3.5" /> Générer le post
            </button>
            {topic.source_url && (
              <a
                href={topic.source_url}
                target="_blank"
                rel="noreferrer"
                data-testid={`topic-source-${index}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-forsides-slate transition-colors hover:border-forsides-red hover:text-forsides-red"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Voir la source
              </a>
            )}
            <button
              data-testid={`topic-ignore-${index}`}
              onClick={() => onIgnore(topic)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-slate-400 transition-colors hover:text-forsides-red"
            >
              <X className="h-3.5 w-3.5" /> Ignorer
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
