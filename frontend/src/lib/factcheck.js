// Figure fact-check: every number and date shown in the post (LinkedIn text, visual, chart)
// must appear in the source it was written from. Runs in the browser, instantly, on each edit.

const MONTHS = "janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre";

// number (with French thousands spaces and decimals) + optional unit right after it
const NUM_RE = new RegExp(
  String.raw`(?<![\p{L}\d.,#/])(\d{1,3}(?:[   ]\d{3})+|\d+)(?:[.,](\d+))?(?![\d])` +
    String.raw`(\s*(?:%|‰|Md€|Mds€|Mds|Md|milliards?|M€|millions?|k€|milliers|€|points?|pts|ans?|mois|er|e|ème)(?![\p{L}]))?`,
  "giu"
);

const MULTIPLIERS = [
  [/^(md€|mds€|mds|md|milliards?)$/i, 1e9],
  [/^(m€|millions?)$/i, 1e6],
  [/^(k€|milliers)$/i, 1e3],
];

const multiplierOf = (unit) => {
  const u = (unit || "").trim().toLowerCase();
  for (const [re, m] of MULTIPLIERS) if (re.test(u)) return m;
  return 1;
};

// Names that contain a number but aren't figures to verify
const IGNORE_BEFORE = /(ifrs|solvabilit[ée]|solvency|b[âa]le|article|art\.|loi|directive|pilier|niveau|classe|covid|g)\s*-?\s*$/i;

const key = (v) => Math.round(v * 1e6) / 1e6;

export function extractFigures(text) {
  const out = [];
  if (!text) return out;
  const str = String(text);
  for (const m of str.matchAll(NUM_RE)) {
    const intPart = m[1].replace(/[   ]/g, "");
    const dec = m[2] || "";
    const unit = (m[3] || "").trim();
    const before = str.slice(Math.max(0, m.index - 14), m.index);
    const after = str.slice(m.index + m[0].length, m.index + m[0].length + 12).toLowerCase();
    if (/^(er|e|ème)$/i.test(unit)) continue; // "1er", "3e" : ordinals
    if (IGNORE_BEFORE.test(before)) continue; // "IFRS 17", "Solvabilité 2", "article 13"
    if (/https?:\/\/\S*$/.test(before)) continue; // inside a URL
    const value = parseFloat(dec ? `${intPart}.${dec}` : intPart);
    if (!Number.isFinite(value)) continue;
    const isYear = !dec && !unit && value >= 1900 && value <= 2100;
    const isDay = !dec && !unit && new RegExp(`^\\s*(${MONTHS})`, "i").test(after);
    // small bare integers ("2 raisons", "3 points clés") are usually wording, not data
    if (!dec && !unit && value < 10 && !isDay) continue;
    out.push({
      raw: m[0].trim(),
      value,
      decimals: dec.length,
      unit,
      scaled: value * multiplierOf(unit),
      kind: isYear ? "date" : isDay ? "jour" : "chiffre",
      index: m.index,
    });
  }
  return out;
}

function sourceIndex(sourceText) {
  const exact = new Set();
  const values = [];
  for (const f of extractFigures(sourceText)) {
    exact.add(key(f.value));
    exact.add(key(f.scaled));
    values.push(f.value, f.scaled);
  }
  // small bare numbers are dropped by extractFigures; keep standalone ones for matching
  // (only < 10, so the "250" inside "1 250" can't wrongly confirm a "250 %")
  for (const m of String(sourceText || "").matchAll(/(?<![\d.,])\d(?:[.,]\d+)?(?![\d])/g)) {
    const v = parseFloat(m[0].replace(",", "."));
    if (Number.isFinite(v)) { exact.add(key(v)); values.push(v); }
  }
  return { exact, values };
}

function statusOf(fig, idx) {
  if (idx.exact.has(key(fig.value)) || idx.exact.has(key(fig.scaled))) return "found";
  // "près de 40 %" when the source says 39,7 % : rounded, acceptable but worth knowing
  const tol = 0.5 * Math.pow(10, -fig.decimals);
  const near = idx.values.some((v) =>
    (Math.abs(v - fig.value) <= tol + 1e-9 || Math.abs(v - fig.scaled) <= tol * multiplierOf(fig.unit) + 1e-9) &&
    v !== fig.value);
  return near ? "rounded" : "missing";
}

const context = (text, index, len) => {
  const s = String(text);
  const a = Math.max(0, index - 45);
  const b = Math.min(s.length, index + len + 45);
  return `${a > 0 ? "…" : ""}${s.slice(a, b).replace(/\s+/g, " ").trim()}${b < s.length ? "…" : ""}`;
};

// What the post shows, grouped by where the reader sees it.
function postTexts(post) {
  const v = post.visual || {};
  const ed = post.editorial || {};
  const visualTexts = [v.title_short, v.subtitle, v.key_figure_value, v.key_figure_label, v.important_date,
    v.insight_line, ed.fact, ed.what_changes, ed.why_important, ed.insight, ...(v.data_points || [])];
  return [
    { place: "Texte LinkedIn", texts: [post.caption] },
    { place: "Visuel", texts: visualTexts },
    { place: "Graphique", texts: [v.chart?.title, v.chart?.note] },
  ];
}

export function runFactCheck(post) {
  const source = post?.source_text || "";
  if (!post || source.replace(/\s+/g, "").length < 40) {
    return { available: false, items: [], missing: 0, rounded: 0, found: 0 };
  }
  const idx = sourceIndex(source);
  const byKey = new Map();
  const add = (fig, place, ctx) => {
    const k = `${key(fig.scaled)}|${fig.kind}`;
    if (!byKey.has(k)) byKey.set(k, { ...fig, status: statusOf(fig, idx), places: [], context: ctx });
    const it = byKey.get(k);
    if (!it.places.includes(place)) it.places.push(place);
  };

  for (const group of postTexts(post)) {
    for (const t of group.texts) {
      if (!t) continue;
      for (const f of extractFigures(t)) add(f, group.place, context(t, f.index, f.raw.length));
    }
  }
  const chart = post.visual?.chart;
  if (chart && Array.isArray(chart.items)) {
    for (const it of chart.items) {
      const value = Number(it.value);
      if (!Number.isFinite(value)) continue;
      const decimals = (String(it.value).split(".")[1] || "").length;
      add({ raw: `${String(value).replace(".", ",")}${chart.unit ? " " + chart.unit : ""}`, value, decimals,
        unit: chart.unit || "", scaled: value * multiplierOf(chart.unit), kind: "chiffre" },
      "Graphique", `${it.label} : ${String(value).replace(".", ",")} ${chart.unit || ""}`.trim());
    }
  }

  const order = { missing: 0, rounded: 1, found: 2 };
  const items = [...byKey.values()].sort((a, b) => order[a.status] - order[b.status]);
  const count = (s) => items.filter((i) => i.status === s).length;
  return { available: true, items, missing: count("missing"), rounded: count("rounded"), found: count("found") };
}
