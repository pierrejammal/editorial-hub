import React, { useState } from "react";
import { resolveContent, hasChart } from "@/lib/visualRender";
import { PenLine, ChevronDown, Plus, Trash2, RotateCcw } from "lucide-react";

const inputCls =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-forsides-red focus:ring-2 focus:ring-forsides-red/20";
const Label = ({ children }) => (
  <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-slate-400">{children}</label>
);
const Section = ({ title, children }) => (
  <div className="space-y-2 border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
    {title && <p className="text-xs font-semibold text-forsides-ink">{title}</p>}
    {children}
  </div>
);

const TAKEAWAY_RE = /retenir|takeaway/i;
const PAGE_TABS = { cover: "Couverture", essential: "L'essentiel", data: "Les chiffres", points: "Décryptage", takeaway: "À retenir" };
const FORMAT_HINT = {
  A: "Format Analyse : L'essentiel + les points d'analyse.",
  B: "Format Data : chiffre clé, chiffres, L'essentiel et les points.",
  C: "Format Graphique : L'essentiel + le graphique.",
};

// Lets the user correct every text block of the visual by hand (instead of regenerating the post).
// Only the texts of the format being viewed are shown; in the carousel, one tab per page.
// Edits are stored in post.visual (custom summary/points, figures, chart) and drawn immediately.
export const VisualTextEditor = ({ post, title, version, updateVisual, carKinds = [], carPage = 0, onCarPage }) => {
  const [open, setOpen] = useState(false);
  const v = post.visual || {};
  const chart = v.chart;
  const isK = version === "K";

  // what the visual currently shows, used as the starting point for editing
  const shown = resolveContent(post, title);
  const custom = v.custom || {};
  const summary = typeof custom.summary === "string" ? custom.summary : shown.summary;
  const points = Array.isArray(custom.points) ? custom.points : shown.points.map((p) => ({ ...p }));

  const setCustom = (patch) => updateVisual({ custom: { summary, points, ...custom, ...patch } });
  const setPoint = (i, patch) => setCustom({ points: points.map((p, k) => (k === i ? { ...p, ...patch } : p)) });
  const setChart = (patch) => updateVisual({ chart: { ...chart, ...patch } });
  const setItem = (i, patch) => setChart({ items: chart.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) });
  const dataPoints = v.data_points || [];

  // ---------- blocks ----------
  const titleField = (
    <div>
      <Label>Titre (couverture)</Label>
      <textarea data-testid="visual-edit-title" rows={2} value={v.title_short ?? title}
        onChange={(e) => updateVisual({ title_short: e.target.value })} className={`${inputCls} resize-y`} />
    </div>
  );

  const summaryField = (
    <div>
      <Label>L'essentiel</Label>
      <textarea data-testid="visual-edit-summary" rows={3} value={summary}
        onChange={(e) => setCustom({ summary: e.target.value })} className={`${inputCls} resize-y`} />
    </div>
  );

  const keyFigure = (
    <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
      <div>
        <Label>Chiffre clé</Label>
        <input value={v.key_figure_value || ""} onChange={(e) => updateVisual({ key_figure_value: e.target.value })} className={`${inputCls} sm:w-36`} />
      </div>
      <div>
        <Label>Libellé du chiffre clé</Label>
        <input value={v.key_figure_label || ""} onChange={(e) => updateVisual({ key_figure_label: e.target.value })} className={inputCls} />
      </div>
    </div>
  );

  const factsField = (label = "Faits chiffrés (une ligne par fait)") => (
    <div>
      <Label>{label}</Label>
      <textarea data-testid="visual-edit-facts" rows={3} value={dataPoints.join("\n")}
        onChange={(e) => updateVisual({ data_points: e.target.value.split("\n") })} className={`${inputCls} resize-y`} />
    </div>
  );

  const dateField = (
    <div>
      <Label>Échéance</Label>
      <input value={v.important_date || ""} onChange={(e) => updateVisual({ important_date: e.target.value })} className={inputCls} />
    </div>
  );

  // points of analysis; `filter` picks which ones (carousel: Décryptage vs À retenir)
  const pointsBlock = (filter = () => true, { addLabel = "Point clé", max = 3 } = {}) => {
    const idx = points.map((p, i) => i).filter((i) => filter(points[i]));
    return (
      <div className="space-y-2">
        {idx.map((i) => (
          <div key={i} className="space-y-1.5 rounded-lg bg-forsides-cream/60 p-2.5">
            <div className="flex gap-2">
              <input data-testid={`visual-edit-point-label-${i}`} value={points[i].label}
                onChange={(e) => setPoint(i, { label: e.target.value })}
                className={`${inputCls} py-1.5 text-xs font-semibold uppercase`} />
              <button type="button" onClick={() => setCustom({ points: points.filter((_, k) => k !== i) })}
                aria-label="Supprimer ce point" className="rounded-lg px-2 text-slate-400 hover:text-forsides-red">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <textarea data-testid={`visual-edit-point-${i}`} rows={2} value={points[i].text}
              onChange={(e) => setPoint(i, { text: e.target.value })} className={`${inputCls} resize-y`} />
          </div>
        ))}
        {idx.length < max && (
          <button type="button" onClick={() => setCustom({ points: [...points, { label: addLabel, text: "" }] })}
            className="inline-flex items-center gap-1 text-xs font-medium text-forsides-slate hover:text-forsides-red">
            <Plus className="h-3.5 w-3.5" /> Ajouter un point
          </button>
        )}
      </div>
    );
  };

  const takeawayIdx = points.findIndex((p) => TAKEAWAY_RE.test(p.label || ""));
  const takeawayBlock = (
    <div className="space-y-2">
      <div>
        <Label>Message à retenir (les guillemets sont ajoutés automatiquement)</Label>
        <textarea data-testid="visual-edit-takeaway" rows={3}
          value={takeawayIdx >= 0 ? points[takeawayIdx].text : (post.editorial?.insight || v.insight_line || "")}
          onChange={(e) => (takeawayIdx >= 0
            ? setPoint(takeawayIdx, { text: e.target.value })
            : setCustom({ points: [...points, { label: "À retenir", text: e.target.value }] }))}
          className={`${inputCls} resize-y`} />
      </div>
      <div>
        <Label>Question de fin</Label>
        <input data-testid="visual-edit-cta-question" maxLength={60} value={v.cta_question ?? ""} placeholder="Vous avez trouvé ce décryptage utile ?"
          onChange={(e) => updateVisual({ cta_question: e.target.value })} className={inputCls} />
      </div>
      <div>
        <Label>Phrase d'appel</Label>
        <input data-testid="visual-edit-cta-text" maxLength={80} value={v.cta_text ?? ""} placeholder="Suivez FORSIDES pour ne rien manquer de l'actualité actuarielle."
          onChange={(e) => updateVisual({ cta_text: e.target.value })} className={inputCls} />
      </div>
    </div>
  );

  const chartBlock = hasChart(post) && (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div>
          <Label>Titre du graphique</Label>
          <input value={chart.title || ""} onChange={(e) => setChart({ title: e.target.value })} className={inputCls} />
        </div>
        <div>
          <Label>Unité</Label>
          <input value={chart.unit || ""} onChange={(e) => setChart({ unit: e.target.value })} className={`${inputCls} w-24`} />
        </div>
        <div>
          <Label>Type</Label>
          <select value={chart.type} onChange={(e) => setChart({ type: e.target.value })} className={`${inputCls} w-32`}>
            <option value="bar">Barres</option>
            <option value="pie">Camembert</option>
          </select>
        </div>
      </div>
      {chart.items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <input data-testid={`visual-edit-chart-label-${i}`} value={it.label}
            onChange={(e) => setItem(i, { label: e.target.value })} className={inputCls} />
          <input data-testid={`visual-edit-chart-value-${i}`} type="number" step="any" value={it.value}
            onChange={(e) => setItem(i, { value: e.target.value === "" ? "" : Number(e.target.value) })} className={`${inputCls} w-32`} />
          <button type="button" disabled={chart.items.length <= 2}
            onClick={() => setChart({ items: chart.items.filter((_, k) => k !== i) })}
            aria-label="Supprimer cette valeur" className="rounded-lg px-2 text-slate-400 hover:text-forsides-red disabled:opacity-30">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {chart.items.length < 6 && (
        <button type="button" onClick={() => setChart({ items: [...chart.items, { label: "Nouveau", value: 0 }] })}
          className="inline-flex items-center gap-1 text-xs font-medium text-forsides-slate hover:text-forsides-red">
          <Plus className="h-3.5 w-3.5" /> Ajouter une valeur
        </button>
      )}
      <div>
        <Label>Phrase de lecture</Label>
        <textarea rows={2} value={chart.note || ""} onChange={(e) => setChart({ note: e.target.value })} className={`${inputCls} resize-y`} />
      </div>
    </div>
  );

  // ---------- carousel: one tab per page ----------
  const tabs = [...new Set(carKinds.length ? carKinds : ["cover", "essential", "data", "points", "takeaway"])];
  const activeKind = carKinds[carPage] || tabs[0];
  const goTab = (kind) => {
    const i = carKinds.indexOf(kind);
    if (i >= 0 && onCarPage) onCarPage(i);
  };
  const hasDataPage = carKinds.includes("data");
  const carouselPage = {
    cover: <Section>{titleField}</Section>,
    essential: (
      <Section>
        {summaryField}
        {keyFigure}
        {!hasDataPage && factsField("Faits clés de la page (une ligne par fait)")}
      </Section>
    ),
    data: (
      <Section>
        {chartBlock || dateField}
        {factsField()}
      </Section>
    ),
    points: <Section>{pointsBlock((p) => !TAKEAWAY_RE.test(p.label || ""))}</Section>,
    takeaway: <Section>{takeawayBlock}</Section>,
  };

  return (
    <div className="rounded-lg border border-slate-200">
      <button type="button" data-testid="visual-text-toggle" onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-forsides-ink hover:text-forsides-red">
        <span className="inline-flex items-center gap-2"><PenLine className="h-4 w-4" /> Modifier le texte du visuel</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div data-testid="visual-text-editor" className="space-y-3 px-3 pb-4">
          {isK ? (
            <>
              <p className="text-xs text-slate-500">Carrousel : choisissez la page à modifier, l'aperçu l'affiche.</p>
              <div className="flex flex-wrap gap-1.5" data-testid="visual-edit-pages">
                {tabs.map((k) => (
                  <button key={k} type="button" data-testid={`visual-edit-page-${k}`} onClick={() => goTab(k)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      activeKind === k ? "bg-forsides-red text-white" : "bg-slate-100 text-forsides-slate hover:bg-slate-200"}`}>
                    {carKinds.indexOf(k) >= 0 ? `${carKinds.indexOf(k) + 1}. ` : ""}{PAGE_TABS[k] || k}
                  </button>
                ))}
              </div>
              {carouselPage[activeKind]}
            </>
          ) : (
            <>
              <p className="text-xs text-slate-500">{FORMAT_HINT[version]} Les changements s'affichent tout de suite.</p>
              <Section>{summaryField}</Section>
              {version === "B" && (
                <Section title="Chiffres">
                  {keyFigure}
                  {dateField}
                  {factsField("Les chiffres (une ligne par chiffre)")}
                </Section>
              )}
              {version === "C" && chartBlock && <Section title="Graphique">{chartBlock}</Section>}
              {version !== "C" && <Section title="Points d'analyse">{pointsBlock(() => true, { addLabel: "À retenir" })}</Section>}
            </>
          )}

          {v.custom && (
            <button type="button" data-testid="visual-edit-reset" onClick={() => updateVisual({ custom: null })}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-forsides-slate hover:text-forsides-red">
              <RotateCcw className="h-3.5 w-3.5" /> Rétablir le texte automatique
            </button>
          )}
        </div>
      )}
    </div>
  );
};
