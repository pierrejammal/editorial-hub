import React, { useEffect, useState } from "react";
import { resolveContent, hasChart } from "@/lib/visualRender";
import { PenLine, ChevronDown, Plus, Trash2, RotateCcw, Type, Hash, Quote, List, MoveVertical, ArrowUp, ArrowDown } from "lucide-react";

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
const EXTRA_TYPES = [
  { type: "text", label: "Texte", icon: Type, title: "À noter" },
  { type: "figure", label: "Chiffre clé", icon: Hash, title: "Le chiffre" },
  { type: "quote", label: "Citation", icon: Quote, title: "Ils l'ont dit" },
  { type: "list", label: "Liste", icon: List, title: "En bref" },
];
const PLACES = [
  ["auto", "Avant « À retenir »"], ["cover", "Après la couverture"], ["essential", "Après L'essentiel"],
  ["data", "Après Les chiffres"], ["points", "Après Décryptage"], ["end", "À la fin"],
];
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

  // ---------- headings & fixed texts (empty = default, shown as placeholder) ----------
  const fr = post.meta?.lang !== "en";
  const multi = shown.multi;
  const labelField = (map, key, label, placeholder, opts = {}) => (
    <div key={`${map}.${key}`}>
      <Label>{label}</Label>
      <textarea data-testid={`visual-edit-${map}-${key}`} rows={opts.rows || 1} value={(v[map] || {})[key] ?? ""} placeholder={placeholder}
        onChange={(e) => updateVisual({ [map]: { ...(v[map] || {}), [key]: e.target.value } })} className={`${inputCls} resize-y`} />
    </div>
  );
  const kLabel = (key, label, def) => labelField("carousel_labels", key, label, def);
  // sources: the main one + any added by hand (shown "Sources : A / B / C")
  const extraSources = Array.isArray(v.extra_sources) ? v.extra_sources : [];
  const setExtraSources = (list) => updateVisual({ extra_sources: list });
  const sourceToggle = (key, def) => {
    const o = (v.page_source || {})[key];
    const on = typeof o === "boolean" ? o : def;
    return (
      <label className="inline-flex items-center gap-2 text-xs font-medium text-forsides-ink">
        <input type="checkbox" data-testid={`visual-show-source-${key}`} checked={on}
          onChange={(e) => updateVisual({ page_source: { ...(v.page_source || {}), [key]: e.target.checked } })} />
        Afficher la source sur cette page
      </label>
    );
  };
  // "Ce qui s'affiche sur cette page": every element of a carousel page can be removed (and put back)
  const SHOWABLE = {
    cover: [["cover.title", "Titre"]],
    essential: [["essential.heading", "Titre de la page"], ["essential.summary", "Résumé"], ["essential.figure", "Chiffre clé"], ["essential.facts", "Faits clés"]],
    data: [["data.heading", "Titre de la page"], ["data.chartTitle", "Titre du graphique"], ["data.chart", "Graphique"], ["data.note", "Phrase sous le graphique"], ["data.date", "Échéance"], ["data.facts", "Faits chiffrés"]],
    points: [["points.heading", "Titre de la page"]],
    takeaway: [["takeaway.heading", "Titre de la page"], ["takeaway.quote", "Message"], ["takeaway.cta", "Question et appel de fin"], ["takeaway.signature", "Signature"]],
  };
  const hiddenMap = v.hidden || {};
  const showList = (kind) => {
    const items = (SHOWABLE[kind] || (String(kind).startsWith("extra-") ? [[`${kind}.heading`, "Titre de la page"]] : []))
      .filter(([key]) => !(kind === "data" && (hasChart(post) ? key === "data.date" : ["data.chartTitle", "data.chart", "data.note"].includes(key))));
    const box = (checked, onChange, label, testid) => (
      <label key={testid} className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs text-forsides-ink ring-1 ring-slate-200">
        <input type="checkbox" data-testid={testid} checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
      </label>
    );
    const ps = (v.page_source || {})[kind];
    return (
      <div data-testid="visual-show-list">
        <p className="mb-1.5 text-xs font-semibold text-forsides-ink">Ce qui s'affiche sur cette page</p>
        <div className="flex flex-wrap gap-1.5">
          {items.map(([key, label]) => box(!hiddenMap[key],
            (on) => updateVisual({ hidden: { ...hiddenMap, [key]: !on } }), label, `visual-show-${key}`))}
          {box(typeof ps === "boolean" ? ps : kind === "cover" || kind === "essential",
            (on) => updateVisual({ page_source: { ...(v.page_source || {}), [kind]: on } }), "Source", `visual-show-source-${kind}`)}
          {(kind === "cover" || kind === "essential") && box(!v.hide_date, (on) => updateVisual({ hide_date: !on }), "Date", `visual-show-date-${kind}`)}
        </div>
      </div>
    );
  };

  const sourceFields = (
    <div className="space-y-2">
    <div className="grid gap-2">
      <div>
        <Label>Source affichée</Label>
        <textarea rows={3} data-testid="visual-edit-source" value={v.source_label ?? ""} placeholder={post.meta?.source || "Nom de la source"}
          onChange={(e) => updateVisual({ source_label: e.target.value })} className={`${inputCls} resize-y`} />
      </div>
    </div>
    {extraSources.map((src, i) => (
      <div key={i} className="flex items-center gap-2">
        <textarea rows={3} data-testid={`visual-extra-source-${i}`} value={src} placeholder="Autre source (ex. Légifrance)"
          onChange={(e) => setExtraSources(extraSources.map((x, k) => (k === i ? e.target.value : x)))} className={`${inputCls} resize-y`} />
        <button type="button" aria-label="Retirer cette source" onClick={() => setExtraSources(extraSources.filter((_, k) => k !== i))}
          className="rounded-lg px-2 text-slate-400 hover:text-forsides-red"><Trash2 className="h-4 w-4" /></button>
      </div>
    ))}
    {extraSources.length < 5 && (
      <button type="button" data-testid="visual-add-source" onClick={() => setExtraSources([...extraSources, ""])}
        className="inline-flex items-center gap-1 text-xs font-medium text-forsides-slate hover:text-forsides-red">
        <Plus className="h-3.5 w-3.5" /> Ajouter une source
      </button>
    )}
    </div>
  );

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
            {points[i].value !== undefined && (
              <input data-testid={`visual-edit-point-value-${i}`} value={points[i].value} placeholder="Chiffre clé (ex. 89,7 %)"
                onChange={(e) => setPoint(i, { value: e.target.value })} className={`${inputCls} font-semibold`} />
            )}
            <textarea data-testid={`visual-edit-point-${i}`} rows={2} value={points[i].text}
              placeholder={points[i].value !== undefined ? "Ce que dit ce chiffre" : "Texte"}
              onChange={(e) => setPoint(i, { text: e.target.value })} className={`${inputCls} resize-y`} />
          </div>
        ))}
        {idx.length < max && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500">Ajouter une partie :</span>
            <button type="button" data-testid="visual-add-part-text" onClick={() => setCustom({ points: [...points, { label: addLabel, text: "" }] })}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-forsides-slate hover:bg-slate-200">
              <Type className="h-3.5 w-3.5" /> Texte
            </button>
            <button type="button" data-testid="visual-add-part-figure" onClick={() => setCustom({ points: [...points, { label: "Chiffre clé", value: "", text: "" }] })}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-forsides-slate hover:bg-slate-200">
              <Hash className="h-3.5 w-3.5" /> Chiffre clé
            </button>
          </div>
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
        <textarea rows={1} data-testid="visual-edit-cta-question" value={v.cta_question ?? ""} placeholder="Vous avez trouvé ce décryptage utile ?"
          onChange={(e) => updateVisual({ cta_question: e.target.value })} className={`${inputCls} resize-y`} />
      </div>
      <div>
        <Label>Phrase d'appel</Label>
        <textarea rows={1} data-testid="visual-edit-cta-text" value={v.cta_text ?? ""} placeholder="Suivez FORSIDES pour ne rien manquer de l'actualité actuarielle."
          onChange={(e) => updateVisual({ cta_text: e.target.value })} className={`${inputCls} resize-y`} />
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

  // ---------- text size sliders ----------
  const slider = (label, value, onChange, testid) => (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-xs font-medium text-forsides-ink">{label}</span>
      <input type="range" min={0.7} max={1.4} step={0.05} value={Number(value) || 1} aria-label={label} data-testid={testid}
        onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-[#C0453A]" />
      <span className="w-11 text-right font-mono text-xs text-forsides-slate">{Math.round((Number(value) || 1) * 100)} %</span>
    </div>
  );
  // "Position du texte": moves the content up/down (also by dragging on the preview with "Déplacer")
  const posBar = (key) => {
    const val = Number((v.content_offset || {})[key]) || 0;
    const set = (n) => updateVisual({ content_offset: { ...(v.content_offset || {}), [key]: n } });
    return (
      <div className="flex items-center gap-3">
        <span className="inline-flex w-32 shrink-0 items-center gap-1 text-xs font-medium text-forsides-ink">
          <MoveVertical className="h-3.5 w-3.5" /> Position du texte
        </span>
        <input type="range" min={-300} max={300} step={5} value={val} aria-label="Position verticale du texte"
          data-testid={`visual-pos-${key}`} onChange={(e) => set(Number(e.target.value))} className="flex-1 accent-[#C0453A]" />
        <span className="w-14 text-right font-mono text-xs text-forsides-slate">{val > 0 ? `↓ ${val}` : val < 0 ? `↑ ${-val}` : "0"}</span>
        {val !== 0 && (
          <button type="button" onClick={() => set(0)} title="Remettre à sa place" aria-label="Remettre à sa place"
            className="text-slate-400 hover:text-forsides-red"><RotateCcw className="h-3.5 w-3.5" /></button>
        )}
      </div>
    );
  };

  // sections added inside one carousel page (below its content)
  const blocksEditor = (kind) => {
    const all = v.page_blocks || {};
    const list = Array.isArray(all[kind]) ? all[kind] : [];
    const save = (next) => updateVisual({ page_blocks: { ...all, [kind]: next } });
    const setB = (i, patch) => save(list.map((b, k) => (k === i ? { ...b, ...patch } : b)));
    const move = (i, dir) => {
      const j = i + dir;
      if (j < 0 || j >= list.length) return;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      save(next);
    };
    return (
      <div className="space-y-2 border-t border-slate-100 pt-3" data-testid="visual-page-blocks">
        {list.map((b, i) => (
          <div key={b.id || i} className="space-y-1.5 rounded-lg bg-forsides-cream/60 p-2.5">
            <div className="flex flex-wrap items-center gap-1">
              {EXTRA_TYPES.map((t) => (
                <button key={t.type} type="button" onClick={() => setB(i, { type: t.type })}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    b.type === t.type ? "bg-forsides-ink text-white" : "bg-white text-forsides-slate hover:bg-slate-200"}`}>
                  <t.icon className="h-3 w-3" /> {t.label}
                </button>
              ))}
              <span className="ml-auto flex items-center gap-1">
                <button type="button" aria-label="Monter" onClick={() => move(i, -1)} className="p-1 text-slate-400 hover:text-forsides-red"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label="Descendre" onClick={() => move(i, 1)} className="p-1 text-slate-400 hover:text-forsides-red"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label="Supprimer cette partie" onClick={() => save(list.filter((_, k) => k !== i))}
                  className="p-1 text-slate-400 hover:text-forsides-red"><Trash2 className="h-3.5 w-3.5" /></button>
              </span>
            </div>
            <textarea rows={1} value={b.title || ""} placeholder="Sous-titre (facultatif)" onChange={(e) => setB(i, { title: e.target.value })}
              className={`${inputCls} resize-y py-1.5 text-xs font-semibold uppercase`} />
            {b.type === "figure" && (
              <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
                <input value={b.value || ""} placeholder="Chiffre (ex. 19,7 Md€)" onChange={(e) => setB(i, { value: e.target.value })} className={`${inputCls} sm:w-40`} />
                <input value={b.label || ""} placeholder="Ce qu'il mesure" onChange={(e) => setB(i, { label: e.target.value })} className={inputCls} />
              </div>
            )}
            <textarea rows={b.type === "list" ? 4 : 3} value={b.text || ""} data-testid={`visual-block-text-${i}`}
              placeholder={b.type === "list" ? "Un élément par ligne" : b.type === "quote" ? "La citation" : b.type === "figure" ? "Commentaire (facultatif)" : "Texte"}
              onChange={(e) => setB(i, { text: e.target.value })} className={`${inputCls} resize-y`} />
            {b.type === "quote" && (
              <input value={b.label || ""} placeholder="Auteur (facultatif)" onChange={(e) => setB(i, { label: e.target.value })} className={inputCls} />
            )}
          </div>
        ))}
        {list.length < 4 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-forsides-ink">Ajouter une partie sur cette page :</span>
            {EXTRA_TYPES.map((t) => (
              <button key={t.type} type="button" data-testid={`visual-add-block-${t.type}`}
                onClick={() => save([...list, { id: Date.now().toString(36), type: t.type, title: "", text: "", value: "", label: "" }])}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-forsides-slate hover:bg-slate-200">
                <Plus className="h-3 w-3" /><t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const pageSize = (kind, label = "Taille du texte") => slider(label, (v.page_text_scale || {})[kind],
    (n) => updateVisual({ page_text_scale: { ...(v.page_text_scale || {}), [kind]: n } }), `visual-size-${kind}`);

  // ---------- carousel: one tab per page ----------
  const tabs = [...new Set(carKinds.length ? carKinds : ["cover", "essential", "data", "points", "takeaway"])];
  const activeKind = carKinds[carPage] || tabs[0];
  const goTab = (kind) => {
    const i = carKinds.indexOf(kind);
    if (i >= 0 && onCarPage) onCarPage(i);
  };

  // pages added by the user (texte, chiffre clé, citation, liste)
  const extras = Array.isArray(v.extra_pages) ? v.extra_pages : [];
  const setExtra = (id, patch) => updateVisual({ extra_pages: extras.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const [pendingKind, setPendingKind] = useState(null);
  useEffect(() => { // show the new page as soon as it exists
    if (pendingKind && carKinds.includes(pendingKind)) { goTab(pendingKind); setPendingKind(null); }
  }, [carKinds, pendingKind]); // eslint-disable-line react-hooks/exhaustive-deps
  const addExtra = (type) => {
    const id = Date.now().toString(36);
    const def = EXTRA_TYPES.find((t) => t.type === type);
    const after = String(activeKind).startsWith("extra-") ? "auto" : activeKind === "takeaway" ? "end" : activeKind;
    updateVisual({ extra_pages: [...extras, { id, type, title: def.title, text: "", value: "", label: "", after }] });
    setPendingKind(`extra-${id}`);
  };
  const extraOf = (kind) => extras.find((x) => `extra-${x.id}` === kind);
  const tabLabel = (k) => {
    const x = extraOf(k);
    if (x) return `+ ${x.title || EXTRA_TYPES.find((t) => t.type === x.type)?.label || "Page"}`;
    return PAGE_TABS[k] || k;
  };
  const extraEditor = (x) => (
    <Section>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-500">Type :</span>
        {EXTRA_TYPES.map((t) => (
          <button key={t.type} type="button" onClick={() => setExtra(x.id, { type: t.type })}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
              x.type === t.type ? "bg-forsides-ink text-white" : "bg-slate-100 text-forsides-slate hover:bg-slate-200"}`}>
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>
      <div>
        <Label>Titre de la page</Label>
        <textarea rows={1} data-testid="visual-extra-title" value={x.title || ""} onChange={(e) => setExtra(x.id, { title: e.target.value })} className={`${inputCls} resize-y`} />
      </div>
      {x.type === "figure" && (
        <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
          <div>
            <Label>Chiffre</Label>
            <input data-testid="visual-extra-value" value={x.value || ""} placeholder="89,7 %" onChange={(e) => setExtra(x.id, { value: e.target.value })} className={`${inputCls} sm:w-40`} />
          </div>
          <div>
            <Label>Ce qu'il mesure</Label>
            <input value={x.label || ""} placeholder="Taux de remboursement AMO des assurés en ALD" onChange={(e) => setExtra(x.id, { label: e.target.value })} className={inputCls} />
          </div>
        </div>
      )}
      <div>
        <Label>{x.type === "list" ? "Éléments (un par ligne)" : x.type === "quote" ? "Citation" : x.type === "figure" ? "Commentaire (facultatif)" : "Texte"}</Label>
        <textarea data-testid="visual-extra-text" rows={x.type === "list" ? 5 : 4} value={x.text || ""}
          onChange={(e) => setExtra(x.id, { text: e.target.value })} className={`${inputCls} resize-y`} />
      </div>
      {x.type === "quote" && (
        <div>
          <Label>Auteur (facultatif)</Label>
          <input value={x.label || ""} placeholder="Nom, fonction" onChange={(e) => setExtra(x.id, { label: e.target.value })} className={inputCls} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Label>Position</Label>
        <select value={x.after || "auto"} onChange={(e) => setExtra(x.id, { after: e.target.value })} className={`${inputCls} w-auto py-1.5 text-xs`}>
          {PLACES.filter(([k]) => ["auto", "end"].includes(k) || carKinds.includes(k)).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button type="button" data-testid="visual-extra-delete"
          onClick={() => { updateVisual({ extra_pages: extras.filter((e) => e.id !== x.id) }); if (onCarPage) onCarPage(Math.max(0, carPage - 1)); }}
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-forsides-slate hover:text-forsides-red">
          <Trash2 className="h-3.5 w-3.5" /> Supprimer cette page
        </button>
      </div>
    </Section>
  );
  const hasDataPage = carKinds.includes("data");
  const carouselPage = {
    cover: (
      <Section>
        {titleField}
        <div className="grid gap-2 sm:grid-cols-2">
          {multi ? kLabel("sources", "Libellé « Sources : »", fr ? "Sources :" : "Sources:") : kLabel("source", "Libellé « Source : »", fr ? "Source :" : "Source:")}
          {kLabel("swipe", "Texte « Faites défiler »", fr ? "Faites défiler" : "Swipe")}
        </div>
        {sourceFields}
      </Section>
    ),
    essential: (
      <Section>
        {kLabel("essential", "Titre de la page", fr ? "L'essentiel" : "In a nutshell")}
        {summaryField}
        {keyFigure}
        {!hasDataPage && factsField("Faits clés de la page (une ligne par fait)")}
      </Section>
    ),
    data: (
      <Section>
        {hasChart(post) ? kLabel("figures", "Titre de la page", fr ? "Les chiffres" : "The figures")
          : kLabel("keyFigures", "Titre de la page", fr ? "Les chiffres clés" : "Key figures")}
        {chartBlock || (
          <>
            {dateField}
            {kLabel("deadline", "Texte sous l'échéance", fr ? "échéance à retenir" : "key deadline")}
          </>
        )}
        {factsField()}
      </Section>
    ),
    points: (
      <Section>
        {kLabel("analysis", "Titre de la page (quand les points sont regroupés)", fr ? "Décryptage" : "Analysis")}
        <p className="text-xs text-slate-500">Quand chaque point a sa propre page, son libellé sert de titre de page.</p>
        {pointsBlock((p) => !TAKEAWAY_RE.test(p.label || ""))}
      </Section>
    ),
    takeaway: (
      <Section>
        {kLabel("takeaway", "Titre de la page", fr ? "À retenir" : "Key takeaway")}
        {takeawayBlock}
      </Section>
    ),
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
              <p className="text-xs text-slate-500">Carrousel : choisissez la page à modifier, l'aperçu l'affiche. Tout ce qui est écrit sur la page se modifie ici ; un champ vide garde le texte d'origine (en grisé).</p>
              <div className="flex flex-wrap gap-1.5" data-testid="visual-edit-pages">
                {tabs.map((k) => (
                  <button key={k} type="button" data-testid={`visual-edit-page-${k}`} onClick={() => goTab(k)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      activeKind === k ? "bg-forsides-red text-white" : "bg-slate-100 text-forsides-slate hover:bg-slate-200"}`}>
                    {carKinds.indexOf(k) >= 0 ? `${carKinds.indexOf(k) + 1}. ` : ""}{tabLabel(k)}
                  </button>
                ))}
              </div>
              {pageSize(activeKind, activeKind === "cover" ? "Taille du titre" : "Taille du texte")}
              {posBar(`k:${activeKind}`)}
              {showList(activeKind)}
              {extraOf(activeKind) ? extraEditor(extraOf(activeKind)) : carouselPage[activeKind]}
              {blocksEditor(activeKind)}
              {extras.length < 6 && (
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs" data-testid="visual-add-page">
                  <span className="font-semibold text-forsides-ink">Ajouter une page après celle-ci :</span>
                  {EXTRA_TYPES.map((t) => (
                    <button key={t.type} type="button" data-testid={`visual-add-page-${t.type}`} onClick={() => addExtra(t.type)}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-forsides-slate hover:bg-slate-200">
                      <Plus className="h-3 w-3" /><t.icon className="h-3.5 w-3.5" /> {t.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-slate-500">{FORMAT_HINT[version]} Les changements s'affichent tout de suite. Un champ vide garde le texte d'origine (affiché en grisé).</p>
              <Section>
                {slider("Taille du titre", v.title_scale, (n) => updateVisual({ title_scale: n }), "visual-size-title")}
                {slider("Taille du texte", v.text_scale, (n) => updateVisual({ text_scale: n }), "visual-size-text")}
                {posBar(version === "C" && !hasChart(post) ? "A" : version)}
                {sourceToggle(version === "C" && !hasChart(post) ? "A" : version, true)}
              </Section>
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
              <Section title="Titres des rubriques, source et date">
                <div className="grid gap-2 sm:grid-cols-2">
                  {labelField("labels", "essential", "Rubrique « L'essentiel »", fr ? "L'ESSENTIEL" : "IN A NUTSHELL")}
                  {version === "B" && labelField("labels", "figures", "Rubrique « Les chiffres »", fr ? "LES CHIFFRES" : "KEY FIGURES")}
                  {version === "B" && labelField("labels", "atSource", "Rubrique « À la source »", fr ? "À LA SOURCE" : "FROM THE SOURCE")}
                  {version === "B" && labelField("labels", "deadline", "Texte sous l'échéance", fr ? "échéance à retenir" : "key deadline")}
                  {multi ? labelField("labels", "sources", "Rubrique « Sources »", "SOURCES") : labelField("labels", "source", "Rubrique « Source »", "SOURCE")}
                </div>
                {sourceFields}
              </Section>
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
