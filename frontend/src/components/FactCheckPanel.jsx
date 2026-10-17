import React, { useMemo, useState } from "react";
import { runFactCheck } from "@/lib/factcheck";
import { ShieldAlert, ShieldCheck, ChevronDown, Info } from "lucide-react";

const STATUS = {
  missing: { label: "Introuvable dans la source", dot: "bg-forsides-red", text: "text-forsides-red" },
  rounded: { label: "Arrondi d'un chiffre de la source", dot: "bg-amber-500", text: "text-amber-700" },
  found: { label: "Retrouvé dans la source", dot: "bg-emerald-600", text: "text-emerald-700" },
};

const Row = ({ it }) => {
  const st = STATUS[it.status];
  return (
    <li className="flex gap-3 rounded-lg border border-slate-100 px-3 py-2.5" data-testid={`factcheck-${it.status}`}>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-sm font-bold text-forsides-ink">{it.raw}</span>
          <span className={`text-xs font-medium ${st.text}`}>{st.label}</span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {it.places.join(" · ")}
          {it.context && <span className="text-slate-400"> — « {it.context} »</span>}
        </p>
      </div>
    </li>
  );
};

export const FactCheckPanel = ({ post }) => {
  const check = useMemo(() => runFactCheck(post), [post]);
  const [showFound, setShowFound] = useState(false);

  const ok = check.available && check.missing === 0;
  const toReview = check.items.filter((i) => i.status !== "found");
  const found = check.items.filter((i) => i.status === "found");

  return (
    <section data-testid="factcheck-panel" className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-serif text-lg font-bold text-forsides-ink">
          {ok ? <ShieldCheck className="h-5 w-5 text-emerald-600" /> : <ShieldAlert className="h-5 w-5 text-forsides-red" />}
          Vérification des chiffres
        </h3>
        {check.available && (
          <span
            data-testid="factcheck-summary"
            className={`rounded-full px-3 py-1 font-mono text-xs font-bold ${
              check.missing ? "bg-forsides-red/10 text-forsides-red" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {check.missing ? `${check.missing} à vérifier` : check.items.length ? "Tout est sourcé" : "Aucun chiffre"}
          </span>
        )}
      </div>

      {!check.available ? (
        <p className="flex gap-2 text-sm text-forsides-slate">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Le texte de la source n'est pas disponible pour ce post (post créé avant cette fonction) :
          vérifiez les chiffres manuellement avant de publier.
        </p>
      ) : (
        <>
          <p className="text-sm text-forsides-slate">
            Chaque chiffre et chaque date du texte LinkedIn, du visuel et du graphique est comparé à la source.
            La vérification se met à jour à chaque modification.
          </p>
          {post.meta?.article_read === false && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              L'article complet n'a pas pu être lu : la vérification porte seulement sur le titre et le résumé
              de la recherche. Un chiffre « introuvable » peut quand même figurer dans l'article, ouvrez-le pour confirmer.
            </p>
          )}

          {toReview.length > 0 && (
            <ul className="mt-4 space-y-2">
              {toReview.map((it) => <Row key={`${it.raw}-${it.places.join()}`} it={it} />)}
            </ul>
          )}
          {check.missing > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              Corrigez ou supprimez ces chiffres dans le texte ou le visuel, ou vérifiez-les dans la source
              {post.meta?.source_url ? (
                <> (<a href={post.meta.source_url} target="_blank" rel="noreferrer" className="underline hover:text-forsides-red">ouvrir l'article</a>)</>
              ) : null}.
            </p>
          )}

          {found.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <button
                data-testid="factcheck-toggle-found"
                onClick={() => setShowFound((s) => !s)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFound ? "rotate-180" : ""}`} />
                {found.length} chiffre{found.length > 1 ? "s" : ""} retrouvé{found.length > 1 ? "s" : ""} dans la source
              </button>
              {showFound && (
                <ul className="mt-2 space-y-2">
                  {found.map((it) => <Row key={`${it.raw}-${it.places.join()}`} it={it} />)}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};
