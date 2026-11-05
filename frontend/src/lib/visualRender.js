// Shared FORSIDES visual rendering (canvas 1200x1500, 4:5) — used by the main
// editor and the "2 concepts" picker so both stay perfectly in sync.

export const VW = 1200;
export const VH = 1500;
const PAD = 66;

// ---------- Template (editable live in "Personnaliser le modèle") ----------
export const DEFAULT_TEMPLATE = {
  background: "#F7E8E4", // fond
  accent: "#C0453A",     // bandeau, puces, chiffres
  titles: "#7A1E1E",     // titres, signature
  secondary: "#E7A390",  // couleur secondaire
  text: "#1b1b1b",       // texte courant
  lines: "#EBC7BD",      // filets et séparateurs
  bannerText: "NEWS",
  bannerShape: "rect",   // rect | rounded | pill | underline
  bulletShape: "square", // square | circle | dash
  ruleStyle: "bar",      // bar | thin | none
  titleFont: "Outfit",   // Outfit | Playfair Display
  showDate: true,
  showSignature: true,
  signature: "For you, by your side",
  bannerScale: 1,        // taille du bandeau NEWS (0.7 – 1.6)
  logoScale: 1,          // taille du logo FORSIDES (0.7 – 1.8)
};
// Live bindings: carouselRender imports these and sees the updated values.
let BLUSH = DEFAULT_TEMPLATE.background;
let BRICK = DEFAULT_TEMPLATE.accent;
let BORDEAUX = DEFAULT_TEMPLATE.titles;
let CORAL = DEFAULT_TEMPLATE.secondary;
let INK = DEFAULT_TEMPLATE.text;
let DOT = DEFAULT_TEMPLATE.lines;
let TPL = { ...DEFAULT_TEMPLATE };
const HEX = /^#[0-9a-f]{3,8}$/i;

/** Applies a template (missing or invalid values fall back to the FORSIDES defaults). */
export function applyTemplate(t) {
  const m = { ...DEFAULT_TEMPLATE, ...(t || {}) };
  for (const k of ["background", "accent", "titles", "secondary", "text", "lines"]) {
    if (!HEX.test(String(m[k]))) m[k] = DEFAULT_TEMPLATE[k];
  }
  TPL = m;
  BLUSH = m.background; BRICK = m.accent; BORDEAUX = m.titles; CORAL = m.secondary; INK = m.text; DOT = m.lines;
}
export const currentTemplate = () => TPL;

// Template scopes: the base settings apply everywhere; template.byFormat[scope] overrides them for one
// format ("A" Analyse, "B" Data, "C" Graphique, "K" whole carousel, "Kcover" its cover, "Kinner" its other pages).
export const TEMPLATE_SCOPES = ["A", "B", "C", "K", "Kcover", "Kinner"];
export function resolveTemplate(t, scopes = []) {
  const { byFormat, ...base } = t || {};
  const out = { ...base };
  scopes.forEach((s) => Object.assign(out, (byFormat && byFormat[s]) || {}));
  return out;
}
// settings chain of each editing scope (later ones win)
export const SCOPE_CHAIN = { all: [], A: ["A"], B: ["B"], C: ["C"], K: ["K"], Kcover: ["K", "Kcover"], Kinner: ["K", "Kinner"] };
// Applies a template change to one scope. "all" = same setting everywhere (per-format exceptions removed);
// "K" = whole carousel (its cover / inner-page exceptions for these settings removed).
export function patchTemplate(t, scope, patch) {
  const byFormat = { ...((t && t.byFormat) || {}) };
  const drop = (k) => {
    if (!byFormat[k]) return;
    const o = { ...byFormat[k] };
    Object.keys(patch).forEach((key) => delete o[key]);
    byFormat[k] = o;
  };
  if (scope === "all" || !SCOPE_CHAIN[scope]) {
    Object.keys(byFormat).forEach(drop);
    return { ...t, ...patch, byFormat };
  }
  if (scope === "K") { drop("Kcover"); drop("Kinner"); }
  byFormat[scope] = { ...(byFormat[scope] || {}), ...patch };
  return { ...t, byFormat };
}
export const carouselScopes = (pageIndex) => ["K", pageIndex === 0 ? "Kcover" : "Kinner"];

// Baseline that centres a text vertically in a box, using the real height of its letters
function textBaseline(ctx, text, top, height, px) {
  const m = ctx.measureText(text);
  const asc = Number.isFinite(m.actualBoundingBoxAscent) && m.actualBoundingBoxAscent > 0 ? m.actualBoundingBoxAscent : px * 0.74;
  const desc = Number.isFinite(m.actualBoundingBoxDescent) ? m.actualBoundingBoxDescent : 0;
  return top + (height - (asc + desc)) / 2 + asc;
}

// Banner (NEWS…) in the template's shape; returns its right edge. Used by the carousel's inner pages.
export function drawBanner(ctx, label, x, y, h, px) {
  if (!label) return x;
  ctx.font = `${Math.min(px, Math.round((h * 0.62) / 0.74))}px Anton`; // letters always inside the banner
  const tw = ctx.measureText(label).width;
  const padX = Math.round(h * 0.2);
  const w = tw + padX * 2;
  const shape = TPL.bannerShape;
  const base = textBaseline(ctx, label, y, h, px);
  ctx.textAlign = "left";
  if (shape === "underline") {
    ctx.fillStyle = BRICK;
    ctx.fillText(label, x, base);
    ctx.fillRect(x, y + h - 4, tw, Math.max(6, h * 0.08));
    return x + tw;
  }
  ctx.fillStyle = BRICK;
  if (shape === "rounded") { roundRect(ctx, x, y, w, h, h * 0.17); ctx.fill(); }
  else if (shape === "pill") { roundRect(ctx, x, y, w + h * 0.16, h, h / 2); ctx.fill(); }
  else ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#fff";
  ctx.fillText(label, x + padX + (shape === "pill" ? h * 0.08 : 0), base);
  return x + w + (shape === "pill" ? h * 0.16 : 0);
}
// size multipliers of the banner and the FORSIDES logo, kept in a safe range
export const tplScale = (k) => {
  const [lo, hi] = k === "logoScale" ? [0.7, 1.8] : [0.7, 1.6];
  const n = Number(TPL[k]);
  return Number.isFinite(n) && n > 0 ? Math.max(lo, Math.min(hi, n)) : 1;
};
export const titleFontFamily = () => (TPL.titleFont === "Playfair Display" ? "'Playfair Display'" : "Outfit");

// bullets in front of points / figure lists, in the template's shape
function drawBullet(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  if (TPL.bulletShape === "circle") {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (TPL.bulletShape === "dash") {
    ctx.fillRect(x - size * 0.2, y + size * 0.38, size * 1.4, size * 0.26);
  } else {
    ctx.fillRect(x, y, size, size);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- Language of the visual (French by default, English for "Version anglaise") ----------
const DICT = {
  fr: {
    essential: "L'ESSENTIEL", figures: "LES CHIFFRES", atSource: "À LA SOURCE", source: "SOURCE", sources: "SOURCES",
    deadline: "échéance à retenir", whatChanges: "Ce qui change", whyImportant: "Pourquoi c'est important",
    takeaway: "À retenir", keyPoint: "Point clé", note: "À noter", also: "Et aussi", locale: "fr-FR",
  },
  en: {
    essential: "IN A NUTSHELL", figures: "KEY FIGURES", atSource: "FROM THE SOURCE", source: "SOURCE", sources: "SOURCES",
    deadline: "key deadline", whatChanges: "What changes", whyImportant: "Why it matters",
    takeaway: "Key takeaway", keyPoint: "Key point", note: "Worth noting", also: "Also", locale: "en-GB",
  },
};
let LANG = "fr";

// Text sizes chosen by the user for this post ("Taille du texte" / "Taille du titre", 0.7 – 1.4)
let TXT = 1;
let TTL = 1;
const clampScale = (x) => { const n = Number(x); return Number.isFinite(n) && n > 0 ? Math.max(0.7, Math.min(1.4, n)) : 1; };
export const setTextScales = (text, title) => { TXT = clampScale(text); TTL = clampScale(title); };
export const titleScale = () => TTL;

export const langOf = (post) => (post?.meta?.lang === "en" ? "en" : "fr");
export const setRenderLang = (lang) => { LANG = lang === "en" ? "en" : "fr"; };
// Headings typed by the user for this post (visual.labels) replace the default ones
// ("L'ESSENTIEL", "LES CHIFFRES", "SOURCE"…). Kept in capitals where the design uses capitals.
let LABELS = {};
const OVERRIDABLE = new Set(["essential", "figures", "atSource", "source", "sources", "deadline"]);
export const setRenderLabels = (o) => { LABELS = o && typeof o === "object" ? o : {}; };
export const T = (key, lang = LANG) => {
  const def = (DICT[lang] || DICT.fr)[key];
  const o = OVERRIDABLE.has(key) ? LABELS[key] : null;
  if (typeof o === "string" && o.trim()) return def && def === def.toUpperCase() ? o.trim().toUpperCase() : o.trim();
  return def;
};

export const loadImage = (src) =>
  new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

// Institutional source identity: real logo file when available, else on-brand emblem.
const LIB = [
  { k: ["acpr", "autorité de contrôle prudentiel"], img: "/logos/acpr.png" },
  { k: ["banque de france", "banque-france"], img: "/logos/banquefrance.png" },
  { k: ["eiopa"], img: "/logos/eiopa.png" },
  { k: ["cour des comptes", "ccomptes"], img: "/logos/courdescomptes.png" },
  { k: ["drees"], acronym: "DREES", name: "Recherche, études, évaluation & statistiques" },
  { k: ["france assureurs", "france assureur"], img: "/logos/franceassureurs.png" },
  { k: ["insee"], img: "/logos/insee.png" },
  { k: ["ocde", "oecd"], img: "/logos/ocde.png" },
  { k: ["commission européenne", "ec.europa", "european commission"], img: "/logos/commission.png" },
  { k: ["ifrs", "iasb"], img: "/logos/ifrs.png" },
  { k: ["sécurité sociale", "securite sociale", "ameli", "urssaf", "assurance maladie", "cnam", "caisse nationale d'assurance",
    "assurance retraite", "cnav", "cnaf", "caisse d'allocations", "msa", "mutualité sociale agricole"], img: "/logos/securitesociale.png" },
  { k: ["assemblée nationale", "sénat", "senat", "parlement français", "ministère", "ministere", "gouvernement", "service-public",
    "legifrance", "légifrance", "journal officiel de la république", "jorf", "premier ministre", "élysée", "elysee",
    "conseil d'état", "conseil constitutionnel", "conseil d'orientation des retraites", "cor-retraites", "haut conseil",
    "hcaam", "hcfips", "direction de la sécurité sociale", "dares", "trésor", "tresor", "economie.gouv", "solidarites.gouv",
    "sante.gouv", "travail-emploi.gouv"], img: "/logos/republique.png" },
];

export const sourceIdentity = (source) => {
  if (!source) return null;
  const s = source.toLowerCase();
  for (const e of LIB) {
    if (e.k.some((kw) => s.includes(kw))) return e;
  }
  return { acronym: null, name: source };
};

export const sourceLogoSrc = (source) => {
  const id = sourceIdentity(source);
  return id && id.img ? id.img : null;
};

function wrapWords(ctx, text, maxW) {
  // a line break typed by the user (Enter) starts a new line on the visual
  const lines = [];
  String(text || "").split(/\n/).forEach((para) => {
    const words = para.split(/\s+/).filter(Boolean);
    // an empty line typed by the user (Enter twice) = space between paragraphs on the visual
    if (!words.length) {
      if (lines.length) { const gap = []; gap.hard = true; gap.blank = true; lines.push(gap); }
      return;
    }
    let line = [];
    for (const w of words) {
      const test = [...line, w].join(" ");
      if (ctx.measureText(test).width > maxW && line.length) {
        lines.push(line);
        line = [w];
      } else line.push(w);
    }
    if (line.length) lines.push(line);
    if (lines.length) lines[lines.length - 1].hard = true; // end of a paragraph: never justified
  });
  return lines;
}

// When text is too long for its box, drop whole trailing sentences rather than cutting a
// sentence in the middle with "…" (a half sentence on the visual reads as an error).
function fitSentences(ctx, text, maxW, maxLines) {
  const t = String(text || "").replace(/[^\S\n]+/g, " ").replace(/ *\n */g, "\n").trim();
  if (wrapWords(ctx, t, maxW).length <= maxLines) return t;
  const sentences = t.split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Ý0-9«"“])/);
  for (let n = sentences.length - 1; n >= 1; n--) {
    const cand = sentences.slice(0, n).join(" ");
    if (wrapWords(ctx, cand, maxW).length <= maxLines) return cand;
  }
  return t; // even one sentence is too long: drawParagraph will shorten it with "…"
}

function drawParagraph(ctx, text, x, y, maxW, lineH, justify, maxLines = 99, draw = true) {
  if (maxLines < 1) return y;
  const lines = wrapWords(ctx, fitSentences(ctx, text, maxW, maxLines), maxW);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    while (lines.length > 1 && lines[lines.length - 1].blank) lines.pop(); // never end on an empty line
    const last = lines[lines.length - 1];
    if (last.length) {
      while (last.length > 1 && ctx.measureText(last.join(" ") + "…").width > maxW) last.pop();
      last[last.length - 1] = last[last.length - 1].replace(/[,;:.]$/, "") + "…";
    }
  }
  if (!draw) return y + lines.length * lineH;
  let cy = y;
  lines.forEach((ln, idx) => {
    const isLast = idx === lines.length - 1;
    const str = ln.join(" ");
    const wordsW = ln.reduce((s, w) => s + ctx.measureText(w).width, 0);
    const gap = ln.length > 1 ? (maxW - wordsW) / (ln.length - 1) : 0;
    // justify only when it looks natural: huge holes between a few words read as a layout bug
    if (justify && !isLast && !ln.hard && ln.length > 1 && gap <= ctx.measureText(" ").width * 3.2) {
      let cx = x;
      ln.forEach((w) => {
        ctx.fillText(w, cx, cy);
        cx += ctx.measureText(w).width + gap;
      });
    } else {
      ctx.fillText(str, x, cy);
    }
    cy += lineH;
  });
  return cy;
}

// The title is never cut: a long title gets a smaller font until it fits in maxLines.
function drawTitle(ctx, title, top, size, lineH, maxLines) {
  const maxW = VW - PAD * 2;
  let px = Math.round(size * TTL);
  const fam = titleFontFamily();
  ctx.font = `800 ${px}px ${fam}`;
  // long titles: smaller, then up to 2 more lines, so the whole title is shown
  while (px > 34 && wrapWords(ctx, title, maxW).length > maxLines) {
    px -= 2;
    ctx.font = `800 ${px}px ${fam}`;
  }
  let lines = maxLines;
  while (px > 24 && wrapWords(ctx, title, maxW).length > lines) {
    if (lines < maxLines + 2) lines += 1;
    else { px -= 2; ctx.font = `800 ${px}px ${fam}`; }
  }
  return drawParagraph(ctx, title, PAD, top, maxW, Math.round((lineH * px) / size), true, lines);
}

function drawEmblem(ctx, id, rightX, topY, fallbackName = "") {
  // right-aligned emblem: acronym chip + name line.
  // Institutions with a logo file have no name of their own: while the logo is loading (or if it
  // fails to load) we write the source name instead of crashing on an undefined name.
  const label = String(id.name || fallbackName || "");
  ctx.textAlign = "right";
  if (id.acronym) {
    ctx.font = "700 20px Outfit";
    const nameW = Math.min(ctx.measureText(label).width, 330);
    ctx.fillStyle = "#555";
    // name (wrapped to max 2 lines) under acronym
    ctx.font = "800 34px Outfit";
    ctx.fillStyle = BORDEAUX;
    ctx.fillText(id.acronym, rightX, topY + 30);
    ctx.font = "500 17px Outfit";
    ctx.fillStyle = "#666";
    ctx.textAlign = "left";
    if (label) drawParagraph(ctx, label, rightX - nameW, topY + 54, nameW, 22, false, 2);
  } else {
    ctx.font = "600 22px Outfit";
    ctx.fillStyle = "#333";
    let name = label;
    while (name.length > 4 && ctx.measureText(name).width > 420) name = name.slice(0, -2).trimEnd() + "…";
    ctx.fillText(name, rightX, topY + 30);
  }
  ctx.textAlign = "left";
}

function drawLabel(ctx, text, x, y) {
  ctx.fillStyle = "#8a6a62";
  ctx.font = "600 18px Outfit";
  const prev = ctx.letterSpacing;
  ctx.letterSpacing = "3px";
  // never wider than the page: smaller letters, then "…"
  const room = ctx.textAlign === "right" ? x - PAD : VW - PAD - x;
  const t = String(text || "").replace(/\s*\n\s*/g, " ");
  if (ctx.measureText(t).width > room) { ctx.letterSpacing = "1px"; ctx.font = "600 15px Outfit"; }
  ctx.fillText(ellipsize(ctx, t, room), x, y);
  ctx.letterSpacing = prev || "0px";
}

function drawRule(ctx, y) {
  if (TPL.ruleStyle === "none") return;
  if (TPL.ruleStyle === "thin") {
    ctx.fillStyle = DOT;
    ctx.fillRect(PAD, y + 1, VW - PAD * 2, 2);
    return;
  }
  ctx.fillStyle = BRICK;
  ctx.fillRect(PAD, y, 90, 5);
  ctx.fillStyle = DOT;
  ctx.fillRect(PAD + 90, y + 1, VW - PAD * 2 - 90, 3);
}

const clean = (s) => (typeof s === "string" ? s.trim() : "");
const firstSentences = (text, n) => {
  const parts = clean(text).replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, n).join(" ");
};

// Resolves what the visual says: résumé + 3 analysis points + source line. Never empty.
export function resolveContent(post, title) {
  const lg = langOf(post);
  const v = post.visual || {};
  const ed = post.editorial || {};
  const m = post.meta || {};
  const t = clean(title);
  const pick = (...cands) => cands.map(clean).find((c) => c && c !== t) || "";

  const summary = pick(v.subtitle, ed.fact, m.summary, post.summary, firstSentences(post.caption, 2));

  let points = [
    { label: T("whatChanges", lg), text: clean(ed.what_changes) },
    { label: T("whyImportant", lg), text: clean(ed.why_important) },
    { label: T("takeaway", lg), text: clean(ed.insight) || clean(v.insight_line) },
  ].filter((p) => p.text && p.text !== summary && p.text !== t);
  if (!points.length) {
    points = (v.data_points || []).map(clean).filter(Boolean).slice(0, 3)
      .map((text, i) => ({ label: [T("keyPoint", lg), T("note", lg), T("takeaway", lg)][i], text }));
  }
  if (!points.length && clean(v.insight_line) && clean(v.insight_line) !== summary) {
    points = [{ label: T("takeaway", lg), text: clean(v.insight_line) }];
  }
  if (!points.length && summary && summary === firstSentences(post.caption, 2)) {
    const rest = clean(post.caption).replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter(Boolean).slice(2, 5);
    points = rest.filter((x) => x.length > 25).map((text, i) => ({ label: [T("note", lg), T("also", lg), T("takeaway", lg)][i], text }));
  }

  // "Source affichée" edited by hand wins; sources added by hand are listed after it
  const extraSrc = (Array.isArray(v.extra_sources) ? v.extra_sources : []).map(clean).filter(Boolean);
  const sourceList = [clean(v.source_label) || clean(m.source), ...extraSrc].filter(Boolean);
  const source = sourceList.join(" / ");
  const srcTitle = pick(m.source_title, post.sources?.[0]?.title, m.topic);
  // several sources ("DREES / Légifrance", multi-link analysis) → "Sources" in the plural
  const multi = Boolean(m.multi_source) || (post.sources || []).length > 1 || /\s[/&+]\s|,|\set\s|\sand\s/i.test(source);
  const auto = { sourceList, multi, summary, points, source, sourceTitle: srcTitle !== source ? srcTitle : "", date: v.hide_date ? "" : clean(v.date_label) || clean(m.date_label) };

  // Text the user edited by hand in "Modifier le texte du visuel" always wins over the automatic choice.
  const cu = v.custom || {};
  if (typeof cu.summary === "string") auto.summary = clean(cu.summary);
  if (Array.isArray(cu.points)) {
    auto.points = cu.points
      .map((p) => ({ label: clean(p.label) || T("takeaway", lg), text: clean(p.text), value: clean(p.value) }))
      .filter((p) => p.text || p.value);
  }
  return auto;
}

// Density-aware scale: sparse content gets bigger type so the canvas never looks empty,
// and dense content gets smaller type so it never runs into the source line / signature.
function fitScale(measure, avail) {
  const s0 = fitScaleAuto(measure, avail);
  if (TXT === 1) return s0;
  // user size on top of the automatic fit, still never overflowing
  let s = s0 * TXT;
  while (s > 0.45 && measure(s) > avail) s -= 0.03;
  return s;
}

function fitScaleAuto(measure, avail) {
  let s = 1;
  if (measure(1) > avail) {
    while (s > 0.62 && measure(s) > avail) s -= 0.04;
    return s;
  }
  for (let i = 0; i < 6; i++) {
    const used = measure(s);
    if (used >= avail * 0.78 || s >= 1.5) break;
    s = Math.min(1.5, s * Math.min(1.18, Math.sqrt((avail * 0.85) / Math.max(used, 1))));
  }
  while (s > 1 && measure(s) > avail) s -= 0.04;
  return s;
}

// Largest font size (px) at which `text` fits in `maxW`, for big figures in Anton.
function fitFontSize(ctx, text, family, size, maxW, min = 40) {
  let px = size;
  ctx.font = `${px}px ${family}`;
  while (px > min && ctx.measureText(text).width > maxW) {
    px -= 4;
    ctx.font = `${px}px ${family}`;
  }
  return px;
}

function renderAnalysis(ctx, { title, content, headerBottom, footerTop }) {
  ctx.fillStyle = BORDEAUX;
  ctx.font = "800 58px Outfit";
  ctx.textAlign = "left";
  const titleTop = Math.max(headerBottom + 110, 310);
  const titleBottom = drawTitle(ctx, title, titleTop, 58, 70, 4);
  drawRule(ctx, titleBottom + 20);

  const maxW = VW - PAD * 2;
  const points = content.points.slice(0, 3);
  const top = titleBottom + 80;
  const bottom = footerTop - 30;
  const blocks = (content.summary ? 1 : 0) + points.length;

  const measure = (s) => {
    let h = 0;
    if (content.summary) {
      ctx.font = `400 ${Math.round(31 * s)}px Outfit`;
      h += 44 * s + drawParagraph(ctx, content.summary, PAD, 0, maxW, 44 * s, false, 6, false);
    }
    ctx.font = `500 ${Math.round(30 * s)}px Outfit`;
    points.forEach((p) => { h += 52 * s + (p.value ? 78 * s : 0) + drawParagraph(ctx, p.text, PAD + 40, 0, maxW - 40, 40 * s, false, 4, false); });
    return h + Math.max(0, blocks - 1) * 40;
  };
  const s = fitScale(measure, bottom - top);
  const used = measure(s) - Math.max(0, blocks - 1) * 40;
  // spread blocks evenly in the free space, but never push them past the bottom
  const gap = blocks > 1 ? Math.max(18, Math.min(120 * s, (bottom - top - used) / (blocks - 1))) : 0;

  let y = top;
  const linesLeft = (lineH, offset) => Math.floor((bottom - y - offset) / lineH);
  if (content.summary) {
    drawLabel(ctx, T("essential"), PAD, y);
    ctx.fillStyle = INK;
    ctx.font = `400 ${Math.round(31 * s)}px Outfit`;
    y = drawParagraph(ctx, content.summary, PAD, y + 44 * s, maxW, 44 * s, true, Math.min(6, linesLeft(44 * s, 44 * s))) + gap;
  }
  points.forEach((p, i) => {
    const room = linesLeft(40 * s, 46 * s);
    if (room < 1) return; // no space left: skip the block rather than overlapping the footer
    ctx.fillStyle = i % 2 === 0 ? BRICK : CORAL;
    drawBullet(ctx, PAD, y - 6, 14, ctx.fillStyle);
    drawLabel(ctx, p.label.toUpperCase(), PAD + 40, y);
    if (p.value) { // "chiffre clé" section: the figure in large, its text below
      ctx.fillStyle = BRICK;
      ctx.font = `${Math.round(72 * s)}px Anton`;
      ctx.fillText(p.value, PAD + 40, y + 88 * s);
      y += 78 * s;
    }
    ctx.fillStyle = i % 2 === 0 ? BORDEAUX : INK;
    ctx.font = `500 ${Math.round(30 * s)}px Outfit`;
    y = drawParagraph(ctx, p.text, PAD + 40, y + 46 * s, maxW - 40, 40 * s, false, Math.min(4, room)) + gap;
  });
}

function renderData(ctx, { v, title, content, headerBottom, footerTop }) {
  ctx.fillStyle = BORDEAUX;
  ctx.font = "800 46px Outfit";
  ctx.textAlign = "left";
  const titleTop = Math.max(headerBottom + 90, 300);
  const titleBottom = drawTitle(ctx, title, titleTop, 46, 56, 4);
  drawRule(ctx, titleBottom + 18);

  const colGap = 60;
  const leftX = PAD;
  const leftW = (VW - PAD * 2 - colGap) * 0.46;
  const rightX = leftX + leftW + colGap;
  const rightW = VW - PAD - rightX;
  const top = titleBottom + 70;
  const bottom = footerTop - 40;
  const hasData = Boolean(v.key_figure_value || v.important_date);
  const points = content.points.slice(0, 3);

  // left column
  let ly = top;
  if (hasData) {
    const fig = String(v.key_figure_value || "");
    const extras = (v.data_points || []).map(clean).filter((d) => d && !(fig && d.includes(fig))).slice(0, 4);
    // draw defaults to false: fitScale calls leftCol(s) to MEASURE only. (Before, the missing
    // argument fell back to drawParagraph's draw=true and left ghost copies of the text.)
    const leftCol = (s, draw = false) => {
      let y = top;
      if (fig) {
        if (draw) { ctx.fillStyle = BRICK; }
        // shrink long figures ("12,5 Md€") so they never run into the right column
        fitFontSize(ctx, fig, "Anton", Math.round(128 * s), leftW);
        if (draw) ctx.fillText(fig, leftX, y + 100 * s);
        y += 118 * s;
        if (v.key_figure_label) {
          if (draw) ctx.fillStyle = INK;
          ctx.font = `500 ${Math.round(27 * s)}px Outfit`;
          y = drawParagraph(ctx, v.key_figure_label, leftX, y + 20 * s, leftW, 36 * s, false, 3, draw) + 40 * s;
        }
      }
      if (v.important_date) {
        if (draw) ctx.fillStyle = CORAL;
        ctx.font = `${Math.round(84 * s)}px Anton`;
        const dy = drawParagraph(ctx, String(v.important_date), leftX, y + 60 * s, leftW, 78 * s, false, 2, draw);
        if (draw) { ctx.fillStyle = INK; ctx.font = `500 ${Math.round(26 * s)}px Outfit`; ctx.fillText(T("deadline"), leftX, dy + 10 * s); }
        y = dy + 50 * s;
      }
      if (extras.length) {
        if (draw) drawLabel(ctx, T("figures"), leftX, y + 40 * s);
        y += 50 * s;
        ctx.font = `500 ${Math.round(25 * s)}px Outfit`;
        extras.forEach((d, i) => {
          if (draw) {
            ctx.fillStyle = i % 2 === 0 ? BRICK : CORAL;
            drawBullet(ctx, leftX, y + 14 * s, 10 * s, ctx.fillStyle);
            ctx.fillStyle = INK;
          }
          y = drawParagraph(ctx, d, leftX + 26 * s, y + 24 * s, leftW - 26 * s, 34 * s, false, 3, draw) + 10 * s;
        });
      }
      return y - top;
    };
    const s = fitScale(leftCol, bottom - top);
    ly = top + leftCol(s, true);
    const room = Math.floor((bottom - ly - 40) / 36);
    if (content.summary && room >= 3) {
      ctx.fillStyle = INK;
      ctx.font = "400 26px Outfit";
      drawParagraph(ctx, content.summary, leftX, ly + 44, leftW, 36, false, room);
    }
  } else {
    const text = content.summary || title;
    const measure = (s) => { ctx.font = `400 ${Math.round(29 * s)}px Outfit`; return 56 * s + drawParagraph(ctx, text, leftX, 0, leftW, 40 * s, false, 12, false); };
    const s = fitScale(measure, bottom - top);
    drawLabel(ctx, T("essential"), leftX, ly + 10);
    ctx.fillStyle = INK;
    ctx.font = `400 ${Math.round(29 * s)}px Outfit`;
    drawParagraph(ctx, text, leftX, ly + 56 * s, leftW, 40 * s, false, Math.floor((bottom - ly - 56 * s) / (40 * s)));
  }

  // right column: analysis points, else the source headline as a pull-quote
  ctx.textAlign = "right";
  const rx = rightX + rightW;
  if (points.length) {
    const measure = (s) => { ctx.font = `600 ${Math.round(34 * s)}px Outfit`; return points.reduce((h, p) => h + 56 * s + (p.value ? 80 * s : 0) + drawParagraph(ctx, p.text, rx, 0, rightW, 44 * s, false, 4, false), 0) + (points.length - 1) * 42; };
    const s = fitScale(measure, bottom - top);
    let ry = top;
    points.forEach((p, i) => {
      const room = Math.floor((bottom - ry - 56 * s) / (44 * s));
      if (room < 1) return;
      drawLabel(ctx, p.label.toUpperCase(), rx, ry + 10);
      if (p.value) {
        ctx.fillStyle = BRICK;
        ctx.font = `${Math.round(74 * s)}px Anton`;
        ctx.fillText(p.value, rx, ry + 100 * s);
        ry += 80 * s;
      }
      ctx.fillStyle = i % 2 === 0 ? BORDEAUX : BRICK;
      ctx.font = `600 ${Math.round(34 * s)}px Outfit`;
      ry = drawParagraph(ctx, p.text, rx, ry + 56 * s, rightW, 44 * s, false, Math.min(4, room)) + 42;
    });
  } else if (content.sourceTitle || content.source) {
    drawLabel(ctx, T("atSource"), rx, top + 10);
    ctx.fillStyle = BRICK;
    ctx.font = "120px Anton";
    ctx.fillText("“", rx, top + 150);
    ctx.fillStyle = BORDEAUX;
    ctx.font = "italic 600 38px Outfit";
    const qy = drawParagraph(ctx, content.sourceTitle || content.source, rx, top + 200, rightW, 50, false, 6);
    if (content.source && content.sourceTitle) {
      ctx.fillStyle = "#4a3a36";
      ctx.font = "500 24px Outfit";
      ctx.fillText(`${content.source}${content.date ? " · " + content.date : ""}`, rx, qy + 16);
    }
  }
  ctx.textAlign = "left";
}

// ---------- Format C · Graphique ----------
const CHART_COLORS = [BRICK, BORDEAUX, CORAL, "#D98A6A", "#9E5A4F", "#E3BBAE"];

export const hasChart = (post) => {
  const c = post?.visual?.chart;
  return Boolean(c && (c.type === "bar" || c.type === "pie") && Array.isArray(c.items) && c.items.length >= 2);
};

const fmtNum = (v) => Number(v).toLocaleString(T("locale"), { maximumFractionDigits: Math.abs(v) < 10 ? 2 : 1 });
const fmtValue = (v, unit) => {
  const n = fmtNum(v);
  if (!unit) return n;
  if (LANG === "en") {
    if (unit === "%") return `${n}%`;
    if (unit.startsWith("€")) return `€${n}${unit.slice(1)}`; // €183.4bn
    return `${n} ${unit}`;
  }
  return unit === "%" ? `${n} %` : `${n} ${unit}`;
};

function ellipsize(ctx, text, maxW) {
  let t = String(text || "");
  if (ctx.measureText(t).width <= maxW) return t;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}

function drawBarChart(ctx, chart, x, y, w, h, { rowMax = 140 } = {}) {
  const items = chart.items;
  const vals = items.map((i) => Number(i.value));
  const lo = Math.min(0, ...vals);
  const hi = Math.max(0, ...vals);
  const span = hi - lo || 1;
  // years / periods ("2023", "T1 2025") read best as vertical columns; names as horizontal bars
  const vertical = items.every((i) => /^(\d{4}|[TSQH]\d[\s-]?\d{2,4}|\d{4}[\s-]\d{2,4})$/i.test(String(i.label).trim()));

  if (vertical) {
    const labelH = 50;
    const valueH = 54;
    const negPad = lo < 0 ? valueH : 0; // room under negative bars for their value, above the axis labels
    const plotTop = y + valueH;
    const plotH = h - labelH - valueH - negPad;
    const colW = w / items.length;
    const barW = Math.min(150, colW * 0.62);
    const zeroY = plotTop + (hi / span) * plotH;
    ctx.fillStyle = DOT;
    ctx.fillRect(x, zeroY - 1, w, 3);
    items.forEach((it, i) => {
      const v = Number(it.value);
      const bh = (Math.abs(v) / span) * plotH;
      const bx = x + colW * i + (colW - barW) / 2;
      const by = v >= 0 ? zeroY - bh : zeroY;
      ctx.fillStyle = i === items.length - 1 ? BRICK : CORAL;
      ctx.fillRect(bx, by, barW, Math.max(bh, 3));
      ctx.textAlign = "center";
      ctx.fillStyle = i === items.length - 1 ? BORDEAUX : INK;
      ctx.font = `${items.length > 4 ? 34 : 42}px Anton`;
      const vy = v >= 0 ? by - 14 : by + Math.max(bh, 3) + 42;
      ctx.fillText(ellipsize(ctx, fmtValue(v, chart.unit), colW - 8), bx + barW / 2, vy);
      ctx.font = "600 24px Outfit";
      ctx.fillStyle = "#4a3a36";
      ctx.fillText(ellipsize(ctx, it.label, colW - 8), bx + barW / 2, y + h - 12);
    });
    ctx.textAlign = "left";
    return;
  }

  // horizontal bars: label on top of each bar, value at the end of the bar
  const rowH = Math.min(rowMax, h / items.length);
  const barH = Math.max(22, rowH * 0.36);
  const valueW = 200;
  const plotW = w - valueW;
  const zeroX = x + (-lo / span) * plotW;
  items.forEach((it, i) => {
    const v = Number(it.value);
    const ry = y + rowH * i;
    ctx.font = "600 26px Outfit";
    ctx.fillStyle = INK;
    ctx.fillText(ellipsize(ctx, it.label, w), x, ry + 30);
    const bw = Math.max(4, (Math.abs(v) / span) * plotW);
    const bx = v >= 0 ? zeroX : zeroX - bw;
    const by = ry + 46;
    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.fillRect(bx, by, bw, barH);
    ctx.fillStyle = BORDEAUX;
    ctx.font = `${Math.round(Math.min(44, barH * 1.25))}px Anton`;
    ctx.fillText(fmtValue(v, chart.unit), Math.max(bx + bw, zeroX) + 16, by + barH * 0.86);
  });
  if (lo < 0) {
    ctx.fillStyle = DOT;
    ctx.fillRect(zeroX - 1, y + 40, 3, rowH * items.length - 40);
  }
}

function drawPieChart(ctx, chart, x, y, w, h) {
  const items = chart.items;
  const total = items.reduce((s, i) => s + Number(i.value), 0) || 1;
  const r = Math.min(h / 2, w * 0.24);
  const cx = x + r;
  const cy = y + h / 2;
  let a = -Math.PI / 2;
  items.forEach((it, i) => {
    const sweep = (Number(it.value) / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a, a + sweep);
    ctx.closePath();
    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.fill();
    a += sweep;
  });
  // donut hole with the largest share in the middle
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.56, 0, Math.PI * 2);
  ctx.fillStyle = BLUSH;
  ctx.fill();
  const top = items.reduce((m, it) => (Number(it.value) > Number(m.value) ? it : m), items[0]);
  ctx.textAlign = "center";
  ctx.fillStyle = BORDEAUX;
  const centerTxt = `${fmtNum((Number(top.value) / total) * 100)} %`;
  fitFontSize(ctx, centerTxt, "Anton", Math.round(r * 0.32), r * 0.9, 24); // stays inside the hole
  ctx.fillText(centerTxt, cx, cy + r * 0.08);
  ctx.font = `600 ${Math.round(Math.max(18, r * 0.11))}px Outfit`;
  ctx.fillStyle = "#4a3a36";
  ctx.fillText(ellipsize(ctx, top.label, r * 0.95), cx, cy + r * 0.3);
  ctx.textAlign = "left";

  // legend
  const lx = x + r * 2 + 60;
  const lw = x + w - lx;
  const rowH = Math.min(96, h / items.length);
  const ly = cy - (rowH * items.length) / 2;
  items.forEach((it, i) => {
    const ry = ly + rowH * i;
    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.fillRect(lx, ry + 12, 26, 26);
    ctx.fillStyle = INK;
    ctx.font = "600 26px Outfit";
    ctx.fillText(ellipsize(ctx, it.label, lw - 42), lx + 42, ry + 34);
    ctx.fillStyle = BORDEAUX;
    ctx.font = "34px Anton";
    const pct = chart.unit === "%" ? "" : `  (${fmtNum((Number(it.value) / total) * 100)} %)`;
    ctx.fillText(ellipsize(ctx, fmtValue(it.value, chart.unit) + pct, lw - 42), lx + 42, ry + 76);
  });
}

// Wraps an uppercase label (chart title) on up to `maxLines` lines instead of cutting it with "…".
function drawLabelLines(ctx, text, x, y, maxW, maxLines = 2) {
  ctx.fillStyle = "#8a6a62";
  ctx.font = "600 18px Outfit";
  const prev = ctx.letterSpacing;
  ctx.letterSpacing = "3px";
  const lines = wrapWords(ctx, text, maxW).slice(0, maxLines);
  lines.forEach((ln, i) => ctx.fillText(ln.join(" "), x, y + i * 28));
  ctx.letterSpacing = prev || "0px";
  return y + (lines.length - 1) * 28;
}

// Largest font size (from `size` down to `min`) at which `text` fits in `maxLines` lines.
function fitTextSize(ctx, text, style, size, min, maxW, maxLines) {
  for (let px = size; px >= min; px -= 1) {
    ctx.font = `${style} ${px}px Outfit`;
    if (wrapWords(ctx, text, maxW).length <= maxLines) return px;
  }
  return 0; // doesn't fit even at the minimum size
}

function renderChart(ctx, { v, title, content, headerBottom, footerTop }) {
  const chart = v.chart;
  ctx.fillStyle = BORDEAUX;
  ctx.font = "800 48px Outfit";
  ctx.textAlign = "left";
  const titleTop = Math.max(headerBottom + 90, 300);
  const titleBottom = drawTitle(ctx, title, titleTop, 48, 58, 3);
  drawRule(ctx, titleBottom + 18);

  const maxW = VW - PAD * 2;
  const bottom = footerTop - 30;
  let y = titleBottom + 74;
  if (chart.title) y = drawLabelLines(ctx, chart.title.toUpperCase(), PAD, y, maxW, 2) + 34;

  // Text blocks under the chart, measured first. Sentences are never cut in the middle:
  // the font gets smaller instead, and only whole sentences are dropped as a last resort.
  const note = clean(chart.note);
  let notePx = note ? fitTextSize(ctx, note, "italic 500", 28, 21, maxW, 3) : 0;
  let noteTxt = note;
  if (note && !notePx) { notePx = 21; ctx.font = "italic 500 21px Outfit"; noteTxt = fitSentences(ctx, note, maxW, 3); }
  ctx.font = `italic 500 ${notePx}px Outfit`;
  const noteLines = note ? Math.min(3, wrapWords(ctx, noteTxt, maxW).length) : 0;
  const noteLH = Math.round(notePx * 1.38);
  const noteH = noteLines ? notePx + (noteLines - 1) * noteLH : 0;

  const summary = content.summary || "";
  let sumPx = summary ? fitTextSize(ctx, summary, "400", 27, 21, maxW, 3) : 0;
  let sumTxt = summary;
  if (summary && !sumPx) { sumPx = 21; ctx.font = "400 21px Outfit"; sumTxt = fitSentences(ctx, summary, maxW, 3); }
  ctx.font = `400 ${sumPx}px Outfit`;
  const sumLines = summary ? Math.min(3, wrapWords(ctx, sumTxt, maxW).length) : 0;
  const sumLH = Math.round(sumPx * 1.4);
  const sumH = sumLines ? 44 + sumPx + (sumLines - 1) * sumLH : 0;

  // Chart height: what the bars actually need (no empty band under 2 bars), within the space left.
  const items = chart.items.length;
  const vertical = chart.type !== "pie" && chart.items.every((i) => /^(\d{4}|[TSQH]\d[\s-]?\d{2,4}|\d{4}[\s-]\d{2,4})$/i.test(String(i.label).trim()));
  const natural = chart.type === "pie" ? 520 : vertical ? 520 : Math.max(220, items * 135);
  const MIN_GAP = 34;
  let showNote = noteLines > 0;
  let showSummary = sumLines > 0;
  const room = () => bottom - y - (showNote ? noteH + MIN_GAP : 0) - (showSummary ? sumH + MIN_GAP : 0);
  if (room() < Math.min(natural, 300) && showSummary) showSummary = false;
  if (room() < Math.min(natural, 300) && showNote) showNote = false;
  const chartH = Math.max(160, Math.min(natural, room()));

  // spread what's left evenly between the blocks instead of leaving one big hole
  const blocks = 1 + (showNote ? 1 : 0) + (showSummary ? 1 : 0);
  const used = chartH + (showNote ? noteH : 0) + (showSummary ? sumH : 0);
  const gap = blocks > 1 ? Math.min(90, Math.max(MIN_GAP, (bottom - y - used) / blocks)) : 0;

  if (chart.type === "pie") drawPieChart(ctx, chart, PAD, y, maxW, chartH);
  else drawBarChart(ctx, chart, PAD, y, maxW, chartH);
  y += chartH + gap;

  if (showNote) {
    ctx.fillStyle = "#4a3a36";
    ctx.font = `italic 500 ${notePx}px Outfit`;
    drawParagraph(ctx, noteTxt, PAD, y + notePx, maxW, noteLH, false, noteLines);
    y += noteH + gap;
  }
  if (showSummary) {
    drawLabel(ctx, T("essential"), PAD, y + 18);
    ctx.fillStyle = INK;
    ctx.font = `400 ${sumPx}px Outfit`;
    drawParagraph(ctx, sumTxt, PAD, y + 44 + sumPx, maxW, sumLH, false, sumLines);
  }
}

function drawSourceFooter(ctx, content, top) {
  if (!content.source && !content.sourceTitle) return;
  ctx.fillStyle = DOT;
  ctx.fillRect(PAD, top, VW - PAD * 2, 2);
  ctx.textAlign = "left";
  const lbl = T(content.multi ? "sources" : "source");
  drawLabel(ctx, lbl, PAD, top + 36);
  const labelW = ctx.measureText(lbl).width + 40;
  let x = PAD + labelW;
  if (content.source) {
    ctx.fillStyle = BORDEAUX;
    ctx.font = "700 24px Outfit";
    ctx.fillText(content.source, x, top + 36);
    x += ctx.measureText(content.source).width + 18;
  }
  if (content.sourceTitle) {
    ctx.fillStyle = "#4a3a36";
    ctx.font = "italic 400 22px Outfit";
    const rest = VW - PAD - x;
    const fits = ctx.measureText(content.sourceTitle).width <= rest;
    if (fits && content.source) ctx.fillText(content.sourceTitle, x, top + 36);
    else drawParagraph(ctx, content.sourceTitle, PAD + labelW, top + (content.source ? 70 : 36), VW - PAD * 2 - labelW, 30, false, 2);
  }
}

// Blush background, NEWS slab, date, FORSIDES logo and source logo. Returns the header's bottom y.
// wrap(id, anchorX, anchorY, draw): lets the carousel move / resize / hide each piece of the header
export function drawHeader(ctx, post, images, wrap = (id, ax, ay, fn) => fn()) {
  const { logoImg, sourceLogoImg } = images || {};
  ctx.fillStyle = BLUSH;
  ctx.fillRect(0, 0, VW, VH);

  // banner (NEWS by default) in the template's shape
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const label = String(TPL.bannerText || "").trim().slice(0, 24);
  const bs = tplScale("bannerScale");
  const padX = 22 * bs;
  const rectY = 52;
  const rectH = Math.round(128 * bs);
  let bannerRight = PAD;
  if (label) wrap("banner", PAD, rectY, () => {
    // long words get a smaller font so the banner never runs into the logos
    // the letters always fit inside the banner (≈ 62 % of its height), centred on their real height
    const px = Math.min(fitFontSize(ctx, label, "Anton", Math.round(118 * bs), Math.min(640, 560 * bs), 40), Math.round(rectH * 0.62 / 0.74));
    ctx.font = `${px}px Anton`;
    const tw = ctx.measureText(label).width;
    const w = tw + padX * 2;
    const shape = TPL.bannerShape;
    if (shape === "underline") {
      ctx.fillStyle = BRICK;
      ctx.fillText(label, PAD, textBaseline(ctx, label, rectY, rectH - 10, px));
      ctx.fillRect(PAD, rectY + rectH - 6, tw, 10);
      bannerRight = PAD + tw;
    } else {
      ctx.fillStyle = BRICK;
      if (shape === "rounded") { roundRect(ctx, PAD, rectY, w, rectH, 22); ctx.fill(); }
      else if (shape === "pill") { roundRect(ctx, PAD, rectY, w + 20, rectH, rectH / 2); ctx.fill(); }
      else ctx.fillRect(PAD, rectY, w, rectH);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.28)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = "#fff";
      ctx.font = `${px}px Anton`;
      ctx.fillText(label, PAD + padX + (shape === "pill" ? 10 : 0), textBaseline(ctx, label, rectY, rectH, px));
      ctx.restore();
      bannerRight = PAD + w + (shape === "pill" ? 20 : 0);
    }
  });
  const bannerBottom = rectY + rectH;

  // date
  if (TPL.showDate && !post.visual?.hide_date) wrap("date", PAD, bannerBottom + 40, () => {
    ctx.fillStyle = INK;
    ctx.font = "500 32px Outfit";
    ctx.textAlign = label ? "right" : "left";
    ctx.fillText((post.visual?.date_label || post.meta?.date_label || "").toUpperCase(), label ? Math.max(bannerRight, PAD + 260) : PAD, bannerBottom + 40);
    ctx.textAlign = "left";
  });

  // FORSIDES logo
  let logoBottom = 60;
  if (logoImg) {
    let lh = 84 * tplScale("logoScale");
    let lw = (logoImg.width / logoImg.height) * lh;
    if (lw > 560) { lw = 560; lh = lw * (logoImg.height / logoImg.width); } // never runs into the banner
    wrap("logo", VW - PAD, 50, () => ctx.drawImage(logoImg, VW - PAD - lw, 50, lw, lh));
    logoBottom = 50 + lh;
  }

  // source (uploaded logo > library logo > emblem)
  if (sourceLogoImg) {
    // size set with the "Taille du logo" slider (0.6 – 2), default a bit larger than before
    const scale = Math.max(0.6, Math.min(2, Number(post.visual?.source_logo_scale) || 1.3));
    const ar = sourceLogoImg.width / sourceLogoImg.height;
    let sh = 64 * scale;
    let sw = ar * sh;
    const maxW = Math.min(260 * scale, 520);
    if (sw > maxW) {
      sw = maxW;
      sh = sw / ar;
    }
    wrap("sourceLogo", VW - PAD, logoBottom + 22, () => ctx.drawImage(sourceLogoImg, VW - PAD - sw, logoBottom + 22, sw, sh));
  } else if (post.meta?.source && !post.visual?.hide_source_logo) {
    const id = sourceIdentity(post.meta.source);
    if (id) wrap("sourceLogo", VW - PAD, logoBottom + 18, () => drawEmblem(ctx, id, VW - PAD, logoBottom + 18, post.meta.source));
  }

  return bannerBottom + 40;
}

export function drawSignature(ctx) {
  if (!TPL.showSignature) return;
  const sig = String(TPL.signature || "").trim();
  if (!sig) return;
  const y = VH - 78;
  ctx.fillStyle = BORDEAUX;
  ctx.font = "700 44px Caveat";
  ctx.textAlign = "center";
  const sw = ctx.measureText(sig).width;
  ctx.fillText(sig, VW / 2, y);
  ctx.textAlign = "left";
  ctx.strokeStyle = BORDEAUX;
  ctx.fillStyle = BORDEAUX;
  ctx.lineWidth = 2;
  const gap = 34;
  const leftEnd = VW / 2 - sw / 2 - gap;
  const rightStart = VW / 2 + sw / 2 + gap;
  const ly2 = y - 14;
  ctx.beginPath();
  ctx.moveTo(PAD + 120, ly2);
  ctx.lineTo(leftEnd, ly2);
  ctx.moveTo(rightStart, ly2);
  ctx.lineTo(VW - PAD - 120, ly2);
  ctx.stroke();
  [leftEnd + 12, rightStart - 12].forEach((dx) => {
    ctx.save();
    ctx.translate(dx, ly2);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  });
}

// opts: { post, version, images:{logoImg, sourceLogoImg} }
export function renderVisual(ctx, { post, version, images, template }) {
  if (template !== undefined) applyTemplate(resolveTemplate(template, [version === "B" || version === "C" ? version : "A"]));
  const v = post.visual || {};
  const title = v.title_short || post.editorial?.fact || post.meta?.topic || "";
  setRenderLang(langOf(post));
  setRenderLabels(v.labels);
  setTextScales(v.text_scale, v.title_scale);
  const headerBottom = drawHeader(ctx, post, images);
  const content = resolveContent(post, title);
  const footerTop = VH - 200;

  // "Position du texte": the content moves, the header, source footer and signature stay in place
  const fmt = version === "C" && hasChart(post) ? "C" : version === "B" ? "B" : "A";
  const off = Math.max(-400, Math.min(400, Number((v.content_offset || {})[fmt]) || 0));
  ctx.save();
  if (off) ctx.translate(0, off);
  if (fmt === "C") renderChart(ctx, { v, title, content, headerBottom, footerTop });
  else if (fmt === "B") renderData(ctx, { v, title, content, headerBottom, footerTop });
  else renderAnalysis(ctx, { title, content, headerBottom, footerTop });
  ctx.restore();

  if ((v.page_source || {})[fmt] !== false) drawSourceFooter(ctx, content, footerTop); // "Afficher la source"
  drawSignature(ctx);
}

export const FONT_SET = ["120px Anton", "800 60px Outfit", "500 28px Outfit", "700 44px Caveat", "140px Anton",
  "800 60px 'Playfair Display'"];

// Building blocks shared with the carousel renderer (carouselRender.js)
export {
  drawParagraph, drawTitle, drawLabel, drawRule, drawSourceFooter, drawBarChart, drawPieChart, drawBullet, roundRect,
  wrapWords, fitSentences, fitFontSize, ellipsize, fmtValue, clean,
  PAD, BLUSH, BRICK, BORDEAUX, CORAL, INK, DOT,
};
