// Shared FORSIDES visual rendering (canvas 1200x1500, 4:5) — used by the main
// editor and the "2 concepts" picker so both stay perfectly in sync.

export const VW = 1200;
export const VH = 1500;
const PAD = 66;
const BLUSH = "#F7E8E4";
const BRICK = "#C0453A";
const BORDEAUX = "#7A1E1E";
const CORAL = "#E7A390";
const INK = "#1b1b1b";
const DOT = "#EBC7BD";

// ---------- Language of the visual (French by default, English for "Version anglaise") ----------
const DICT = {
  fr: {
    essential: "L'ESSENTIEL", figures: "LES CHIFFRES", atSource: "À LA SOURCE", source: "SOURCE",
    deadline: "échéance à retenir", whatChanges: "Ce qui change", whyImportant: "Pourquoi c'est important",
    takeaway: "À retenir", keyPoint: "Point clé", note: "À noter", also: "Et aussi", locale: "fr-FR",
  },
  en: {
    essential: "IN A NUTSHELL", figures: "KEY FIGURES", atSource: "FROM THE SOURCE", source: "SOURCE",
    deadline: "key deadline", whatChanges: "What changes", whyImportant: "Why it matters",
    takeaway: "Key takeaway", keyPoint: "Key point", note: "Worth noting", also: "Also", locale: "en-GB",
  },
};
let LANG = "fr";
export const langOf = (post) => (post?.meta?.lang === "en" ? "en" : "fr");
export const setRenderLang = (lang) => { LANG = lang === "en" ? "en" : "fr"; };
export const T = (key, lang = LANG) => (DICT[lang] || DICT.fr)[key];

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
  { k: ["ifrs"], img: "/logos/ifrs.png" },
  { k: ["sécurité sociale", "securite sociale", "ameli", "urssaf"], img: "/logos/securitesociale.png" },
  { k: ["parlement", "assemblée", "sénat", "ministère", "ministere", "gouvernement", "service-public", "legifrance", "légifrance"], img: "/logos/republique.png" },
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
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = [];
  for (const w of words) {
    const test = [...line, w].join(" ");
    if (ctx.measureText(test).width > maxW && line.length) {
      lines.push(line);
      line = [w];
    } else line.push(w);
  }
  if (line.length) lines.push(line);
  return lines;
}

// When text is too long for its box, drop whole trailing sentences rather than cutting a
// sentence in the middle with "…" (a half sentence on the visual reads as an error).
function fitSentences(ctx, text, maxW, maxLines) {
  const t = (text || "").replace(/\s+/g, " ").trim();
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
    const last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(last.join(" ") + "…").width > maxW) last.pop();
    last[last.length - 1] = last[last.length - 1].replace(/[,;:.]$/, "") + "…";
  }
  if (!draw) return y + lines.length * lineH;
  let cy = y;
  lines.forEach((ln, idx) => {
    const isLast = idx === lines.length - 1;
    const str = ln.join(" ");
    const wordsW = ln.reduce((s, w) => s + ctx.measureText(w).width, 0);
    const gap = ln.length > 1 ? (maxW - wordsW) / (ln.length - 1) : 0;
    // justify only when it looks natural: huge holes between a few words read as a layout bug
    if (justify && !isLast && ln.length > 1 && gap <= ctx.measureText(" ").width * 3.2) {
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
  let px = size;
  ctx.font = `800 ${px}px Outfit`;
  while (px > 34 && wrapWords(ctx, title, maxW).length > maxLines) {
    px -= 2;
    ctx.font = `800 ${px}px Outfit`;
  }
  return drawParagraph(ctx, title, PAD, top, maxW, Math.round((lineH * px) / size), true, maxLines);
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
  ctx.fillText(text, x, y);
  ctx.letterSpacing = prev || "0px";
}

function drawRule(ctx, y) {
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

  const source = clean(m.source);
  const srcTitle = pick(m.source_title, post.sources?.[0]?.title, m.topic);
  const auto = { summary, points, source, sourceTitle: srcTitle !== source ? srcTitle : "", date: clean(m.date_label) };

  // Text the user edited by hand in "Modifier le texte du visuel" always wins over the automatic choice.
  const cu = v.custom || {};
  if (typeof cu.summary === "string") auto.summary = clean(cu.summary);
  if (Array.isArray(cu.points)) {
    auto.points = cu.points
      .map((p) => ({ label: clean(p.label) || T("takeaway", lg), text: clean(p.text) }))
      .filter((p) => p.text);
  }
  return auto;
}

// Density-aware scale: sparse content gets bigger type so the canvas never looks empty,
// and dense content gets smaller type so it never runs into the source line / signature.
function fitScale(measure, avail) {
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
    points.forEach((p) => { h += 52 * s + drawParagraph(ctx, p.text, PAD + 40, 0, maxW - 40, 40 * s, false, 4, false); });
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
    ctx.fillRect(PAD, y - 6, 14, 14);
    drawLabel(ctx, p.label.toUpperCase(), PAD + 40, y);
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
            ctx.fillRect(leftX, y + 14 * s, 10 * s, 10 * s);
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
    const measure = (s) => { ctx.font = `600 ${Math.round(34 * s)}px Outfit`; return points.reduce((h, p) => h + 56 * s + drawParagraph(ctx, p.text, rx, 0, rightW, 44 * s, false, 4, false), 0) + (points.length - 1) * 42; };
    const s = fitScale(measure, bottom - top);
    let ry = top;
    points.forEach((p, i) => {
      const room = Math.floor((bottom - ry - 56 * s) / (44 * s));
      if (room < 1) return;
      drawLabel(ctx, p.label.toUpperCase(), rx, ry + 10);
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

function drawBarChart(ctx, chart, x, y, w, h) {
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
  const rowH = Math.min(140, h / items.length);
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

function renderChart(ctx, { v, title, content, headerBottom, footerTop }) {
  const chart = v.chart;
  ctx.fillStyle = BORDEAUX;
  ctx.font = "800 48px Outfit";
  ctx.textAlign = "left";
  const titleTop = Math.max(headerBottom + 90, 300);
  const titleBottom = drawTitle(ctx, title, titleTop, 48, 58, 3);
  drawRule(ctx, titleBottom + 18);

  const maxW = VW - PAD * 2;
  const bottom = footerTop - 34;
  let y = titleBottom + 74;
  if (chart.title) {
    drawLabel(ctx, ellipsize(ctx, chart.title.toUpperCase(), maxW), PAD, y);
    y += 30;
  }

  // Text under the chart: only whole sentences, never a sentence cut with "…".
  // Each block's exact height: first baseline offset + (lines - 1) * line height.
  const LH = 38;
  const note = clean(chart.note);
  ctx.font = "italic 500 28px Outfit";
  const noteTxt = note ? fitSentences(ctx, note, maxW, 2) : "";
  const noteLines = noteTxt && wrapWords(ctx, noteTxt, maxW).length <= 2 ? wrapWords(ctx, noteTxt, maxW).length : 0;
  const noteH = noteLines ? 40 + (noteLines - 1) * LH + 10 : 0;
  ctx.font = "400 27px Outfit";
  const sumTxt = content.summary ? fitSentences(ctx, content.summary, maxW, 3) : "";
  const sumLines = sumTxt && wrapWords(ctx, sumTxt, maxW).length <= 3 ? wrapWords(ctx, sumTxt, maxW).length : 0;
  const sumH = sumLines ? 36 + 44 + (sumLines - 1) * LH + 10 : 0;

  const MIN_CHART = 400; // the chart comes first: drop the summary, then the note, before squeezing it
  let showSummary = sumLines > 0;
  let showNote = noteLines > 0;
  let chartH = bottom - y - (showNote ? noteH : 0) - (showSummary ? sumH : 0) - 30;
  if (chartH < MIN_CHART && showSummary) { showSummary = false; chartH += sumH; }
  if (chartH < MIN_CHART && showNote) { showNote = false; chartH += noteH; }
  chartH = Math.min(chartH, 640);

  if (chart.type === "pie") drawPieChart(ctx, chart, PAD, y, maxW, chartH);
  else drawBarChart(ctx, chart, PAD, y, maxW, chartH);
  y += chartH + 30;

  if (showNote) {
    ctx.fillStyle = "#4a3a36";
    ctx.font = "italic 500 28px Outfit";
    y = drawParagraph(ctx, noteTxt, PAD, y + 40, maxW, LH, false, noteLines) - LH + 10;
  }
  if (showSummary && y + sumH <= bottom + 10) {
    drawLabel(ctx, T("essential"), PAD, y + 36);
    ctx.fillStyle = INK;
    ctx.font = "400 27px Outfit";
    drawParagraph(ctx, sumTxt, PAD, y + 80, maxW, LH, false, sumLines);
  }
}

function drawSourceFooter(ctx, content, top) {
  if (!content.source && !content.sourceTitle) return;
  ctx.fillStyle = DOT;
  ctx.fillRect(PAD, top, VW - PAD * 2, 2);
  ctx.textAlign = "left";
  drawLabel(ctx, T("source"), PAD, top + 36);
  const labelW = ctx.measureText(T("source")).width + 40;
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
export function drawHeader(ctx, post, images) {
  const { logoImg, sourceLogoImg } = images || {};
  ctx.fillStyle = BLUSH;
  ctx.fillRect(0, 0, VW, VH);

  // NEWS slab
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = "118px Anton";
  const label = "NEWS";
  const tw = ctx.measureText(label).width;
  const padX = 22;
  const rectY = 52;
  const rectH = 128;
  ctx.fillStyle = BRICK;
  ctx.fillRect(PAD, rectY, tw + padX * 2, rectH);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#fff";
  ctx.fillText(label, PAD + padX, rectY + rectH - 26);
  ctx.restore();
  const bannerRight = PAD + tw + padX * 2;
  const bannerBottom = rectY + rectH;

  // date
  ctx.fillStyle = INK;
  ctx.font = "500 32px Outfit";
  ctx.textAlign = "right";
  ctx.fillText((post.meta?.date_label || "").toUpperCase(), bannerRight, bannerBottom + 40);
  ctx.textAlign = "left";

  // FORSIDES logo
  let logoBottom = 60;
  if (logoImg) {
    const lh = 84;
    const lw = (logoImg.width / logoImg.height) * lh;
    ctx.drawImage(logoImg, VW - PAD - lw, 50, lw, lh);
    logoBottom = 50 + lh;
  }

  // source (uploaded logo > library logo > emblem)
  if (sourceLogoImg) {
    const ar = sourceLogoImg.width / sourceLogoImg.height;
    let sh = 64;
    let sw = ar * sh;
    if (sw > 260) {
      sw = 260;
      sh = sw / ar;
    }
    ctx.drawImage(sourceLogoImg, VW - PAD - sw, logoBottom + 22, sw, sh);
  } else if (post.meta?.source) {
    const id = sourceIdentity(post.meta.source);
    if (id) drawEmblem(ctx, id, VW - PAD, logoBottom + 18, post.meta.source);
  }

  return bannerBottom + 40;
}

export function drawSignature(ctx) {
  // signature
  const y = VH - 78;
  ctx.fillStyle = BORDEAUX;
  ctx.font = "700 44px Caveat";
  ctx.textAlign = "center";
  const sig = "For you, by your side";
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
export function renderVisual(ctx, { post, version, images }) {
  const v = post.visual || {};
  const title = v.title_short || post.editorial?.fact || post.meta?.topic || "";
  setRenderLang(langOf(post));
  const headerBottom = drawHeader(ctx, post, images);
  const content = resolveContent(post, title);
  const footerTop = VH - 200;

  if (version === "C" && hasChart(post)) renderChart(ctx, { v, title, content, headerBottom, footerTop });
  else if (version === "B") renderData(ctx, { v, title, content, headerBottom, footerTop });
  else renderAnalysis(ctx, { title, content, headerBottom, footerTop });

  drawSourceFooter(ctx, content, footerTop);
  drawSignature(ctx);
}

export const FONT_SET = ["120px Anton", "800 60px Outfit", "500 28px Outfit", "700 44px Caveat", "140px Anton"];

// Building blocks shared with the carousel renderer (carouselRender.js)
export {
  drawParagraph, drawTitle, drawLabel, drawRule, drawSourceFooter, drawBarChart, drawPieChart,
  wrapWords, fitSentences, fitFontSize, ellipsize, fmtValue, clean,
  PAD, BLUSH, BRICK, BORDEAUX, CORAL, INK, DOT,
};
