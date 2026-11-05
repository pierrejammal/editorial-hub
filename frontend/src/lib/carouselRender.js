// LinkedIn carousel: the same post told in 4-6 swipeable pages, same FORSIDES style as the visual.
import {
  VW, VH, drawHeader, drawSignature, resolveContent, hasChart,
  drawParagraph, drawLabel, drawRule, drawBarChart, drawPieChart, wrapWords, fitSentences, fitFontSize,
  clean, PAD, BLUSH, BRICK, BORDEAUX, CORAL, INK, DOT, langOf, setRenderLang,
  applyTemplate, currentTemplate, tplScale, setRenderLabels, ellipsize, resolveTemplate, carouselScopes, drawBanner, titleFontFamily, drawBullet, roundRect,
} from "@/lib/visualRender";

const CL = {
  fr: {
    swipe: "Faites défiler", source: "Source :", sources: "Sources :", essential: "L'essentiel", figures: "Les chiffres",
    keyFigures: "Les chiffres clés", deadline: "échéance à retenir", analysis: "Décryptage", takeaway: "À retenir",
    ctaQ: "Vous avez trouvé ce décryptage utile ?", cta: "Suivez FORSIDES pour ne rien manquer de l'actualité actuarielle.",
  },
  en: {
    swipe: "Swipe", source: "Source:", sources: "Sources:", essential: "In a nutshell", figures: "The figures",
    keyFigures: "Key figures", deadline: "key deadline", analysis: "Analysis", takeaway: "Key takeaway",
    ctaQ: "Found this analysis useful?", cta: "Follow FORSIDES for the latest actuarial and insurance news.",
  },
};
let L = CL.fr;
const TAKEAWAY_RE = /retenir|takeaway/i;

const MAXW = VW - PAD * 2;

// ---------- position ("Position du texte") and sections added inside a page ----------
let CUR_KIND = null; // kind of the page being drawn
let SHIFTED = false;
const offsetOf = (v, key) => {
  const n = Number(((v && v.content_offset) || {})[key]);
  return Number.isFinite(n) ? Math.max(-400, Math.min(400, n)) : 0;
};
// moves the page content (not the header, page number, "Faites défiler" or the signature)
function beginShift(ctx, d) {
  const off = offsetOf(d.v, `k:${CUR_KIND}`);
  if (!off) return;
  ctx.save();
  ctx.translate(0, off);
  SHIFTED = true;
}
function endShift(ctx) {
  if (!SHIFTED) return;
  ctx.restore();
  SHIFTED = false;
}

// Size and position of each element of a page, set one by one by the user:
// visual.el["points:pt-2"] = { s: 1.2 (size ×), y: -40 (px, up < 0 < down) }
const elKey = (id) => `${CUR_KIND}:${id}`;
function elScale(d, id) {
  const n = Number(((d.v.el || {})[elKey(id)] || {}).s);
  return Number.isFinite(n) && n > 0 ? Math.max(0.5, Math.min(1.6, n)) : 1;
}
function elDx(d, id) {
  const n = Number(((d.v.el || {})[elKey(id)] || {}).x);
  return Number.isFinite(n) ? Math.max(-500, Math.min(500, n)) : 0;
}
function elDy(d, id) {
  const n = Number(((d.v.el || {})[elKey(id)] || {}).y);
  return Number.isFinite(n) ? Math.max(-400, Math.min(400, n)) : 0;
}
// ---------- where each element is drawn (so a click on the preview can select it) ----------
let TRACKERS = [];
let BOXES = [];
function startTrack(key) {
  const t = { key, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  TRACKERS.push(t);
  return t;
}
function endTrack(t) {
  TRACKERS = TRACKERS.filter((x) => x !== t);
  if (t.x1 > t.x0 && t.y1 > t.y0) BOXES.push({ key: t.key, x0: t.x0, y0: t.y0, x1: t.x1, y1: t.y1 });
}
function noteBox(ctx, x0, y0, x1, y1) {
  if (!TRACKERS.length) return;
  const m = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  [[x0, y0], [x1, y1], [x0, y1], [x1, y0]].forEach(([x, y]) => {
    const px = m ? m.a * x + m.c * y + m.e : x;
    const py = m ? m.b * x + m.d * y + m.f : y;
    TRACKERS.forEach((t) => {
      t.x0 = Math.min(t.x0, px); t.y0 = Math.min(t.y0, py);
      t.x1 = Math.max(t.x1, px); t.y1 = Math.max(t.y1, py);
    });
  });
}
// records the area of every text / shape drawn while an element is being tracked
function instrument(ctx) {
  const ft = ctx.fillText.bind(ctx);
  const fr = ctx.fillRect.bind(ctx);
  const ar = ctx.arc.bind(ctx);
  ctx.fillText = (t, x, y, ...rest) => {
    if (TRACKERS.length) {
      const px = Number((/(\d+(?:\.\d+)?)px/.exec(ctx.font) || [])[1]) || 20;
      const w = ctx.measureText(String(t)).width;
      const a = ctx.textAlign;
      const xs = a === "right" || a === "end" ? x - w : a === "center" ? x - w / 2 : x;
      noteBox(ctx, xs, y - px * 0.85, xs + w, y + px * 0.25);
    }
    return ft(t, x, y, ...rest);
  };
  ctx.fillRect = (x, y, w, h) => { noteBox(ctx, x, y, x + w, y + h); return fr(x, y, w, h); };
  ctx.arc = (x, y, r, ...rest) => { noteBox(ctx, x - r, y - r, x + r, y + r); return ar(x, y, r, ...rest); };
  const di = ctx.drawImage.bind(ctx);
  ctx.drawImage = (img, ...a) => {
    if (a.length === 4) noteBox(ctx, a[0], a[1], a[0] + a[2], a[1] + a[3]);
    else if (a.length === 8) noteBox(ctx, a[4], a[5], a[4] + a[6], a[5] + a[7]);
    return di(img, ...a);
  };
}
function track(ctx, key, fn) {
  const t = startTrack(key);
  try { return fn(); } finally { endTrack(t); }
}

// draws one text element moved by its own offsets (and records where it is); its size is applied by the caller
function withEl(ctx, d, id, fn) {
  if ((id.startsWith("pt-") || id.startsWith("blk-")) && isHidden(d, `${CUR_KIND}.${id}`)) return 0;
  const dx = elDx(d, id);
  const dy = elDy(d, id);
  return track(ctx, elKey(id), () => {
    if (!dy && !dx) return fn();
    ctx.save();
    ctx.translate(dx, dy);
    try { return fn(); } finally { ctx.restore(); }
  });
}
// decorations (banner, logos, page number, quote marks, lines, signature…): moved, resized around
// their anchor point, or hidden — each one on its own
let CUR_D = null;
function deco(ctx, d, id, ax, ay, fn) {
  if (!d) return fn();
  if (isHidden(d, `${CUR_KIND}.${id}`)) return undefined;
  const s = elScale(d, id);
  const dx = elDx(d, id);
  const dy = elDy(d, id);
  return track(ctx, elKey(id), () => {
    if (s === 1 && !dx && !dy) return fn();
    ctx.save();
    ctx.translate(ax + dx, ay + dy);
    ctx.scale(s, s);
    ctx.translate(-ax, -ay);
    try { return fn(); } finally { ctx.restore(); }
  });
}

// elements removed by the user on a page ("Ce qui s'affiche sur cette page"): visual.hidden["data.chart"] = true…
function isHidden(d, key) { return Boolean((d.v.hidden || {})[key]); }
// page title, unless removed (then the content moves up)
function heading(ctx, d, text, y) {
  if (isHidden(d, `${CUR_KIND}.heading`) || !String(text || "").trim()) return -70;
  return withEl(ctx, d, "heading", () => bigLabel(ctx, text, y, elScale(d, "heading")));
}

const blocksOf = (d, pos = "bottom") => {
  const all = (d.v.page_blocks || {})[CUR_KIND];
  return Array.isArray(all)
    ? all.filter((b) => b && (clean(b.text) || clean(b.value) || clean(b.intro) || clean(b.col1) || clean(b.col2) || clean(b.col1t) || clean(b.col2t)) && (b.pos === "top" ? "top" : "bottom") === pos).slice(0, 4) : [];
};
// one section; returns its height (draw = false only measures)
function drawBlock(ctx, b, y, k, draw) {
  let h = 0;
  const title = clean(b.title);
  if (title) {
    if (draw) drawLabel(ctx, title.toUpperCase(), PAD, y + 18);
    h += 40;
  }
  const text = clean(b.text);
  const para = (t, font, px, maxLines, x = PAD, w = MAXW, color = INK) => {
    ctx.font = `${font} ${px}px Outfit`;
    const lh = Math.round(px * 1.35);
    const lines = Math.min(maxLines, wrapWords(ctx, t, w).length);
    if (draw) { ctx.fillStyle = color; drawParagraph(ctx, t, x, y + h + px, w, lh, false, maxLines); }
    h += lines * lh;
  };
  if (b.type === "figure") {
    const value = clean(b.value);
    if (value) {
      const px = fitFontSize(ctx, value, "Anton", Math.round(96 * k), MAXW, 48);
      if (draw) { ctx.fillStyle = BRICK; ctx.font = `${px}px Anton`; ctx.fillText(value, PAD, y + h + px * 0.86); }
      h += px + 8;
    }
    if (clean(b.label)) para(clean(b.label), 600, Math.round(30 * k), 3, PAD, MAXW, BORDEAUX);
    if (text) { h += 8; para(text, 400, Math.round(27 * k), 4); }
  } else if (b.type === "quote") {
    if (draw) { ctx.fillStyle = BRICK; ctx.font = "100px Anton"; ctx.fillText("“", PAD - 6, y + h + 80); }
    para(text.replace(/^[\s«»“”"']+|[\s«»“”"']+$/g, ""), "italic 600", Math.round(34 * k), 5, PAD + 70, MAXW - 70, BORDEAUX);
    if (clean(b.label)) {
      if (draw) { ctx.fillStyle = "#4a3a36"; ctx.font = "600 26px Outfit"; ctx.fillText(`— ${clean(b.label)}`, PAD + 70, y + h + 40); }
      h += 50;
    }
  } else if (b.type === "offer") {
    h += drawOffer(ctx, b, y + h, k * 0.85, draw);
  } else if (b.type === "columns") {
    h += drawColumns(ctx, b, y + h, k, draw);
  } else if (b.type === "list") {
    text.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, 6).forEach((t, i) => {
      if (draw) drawBullet(ctx, PAD, y + h + 8, 16, i % 2 === 0 ? BRICK : CORAL);
      para(t, 600, Math.round(30 * k), 2, PAD + 44, MAXW - 44, INK);
      h += 14;
    });
  } else {
    para(text, 500, Math.round(32 * k), 6);
  }
  return h;
}
const BLOCK_GAP = 34;
// room taken at the bottom of the page by its added sections (the page content is laid out above)
// "Afficher la source sur cette page": shown by default on the cover and L'essentiel only
const showSource = (d, kind) => {
  const o = (d.v.page_source || {})[kind];
  return typeof o === "boolean" ? o : kind === "cover" || kind === "essential";
};
const sourceLine = (d) => (d.content.source
  ? `${d.content.multi ? L.sources : L.source} ${d.content.source}${d.content.date ? " · " + d.content.date.toLowerCase() : ""}` : "");
// Source(s) block: one source → "Source : X · date"; several → "Sources · date" then one source per line.
// Long names wrap (up to 3 lines each) instead of being cut. Returns its height (draw = false only measures).
function sourceBlock(ctx, d, x, y, maxW, px, draw) {
  const list = d.content.sourceList && d.content.sourceList.length ? d.content.sourceList : (d.content.source ? [d.content.source] : []);
  if (!list.length) return 0;
  const date = d.content.date ? d.content.date.toLowerCase() : "";
  const lh = Math.round(px * 1.32);
  let h = 0;
  ctx.fillStyle = "#4a3a36";
  if (list.length === 1) {
    ctx.font = `500 ${px}px Outfit`;
    const t = `${L.source} ${list[0]}${date ? " · " + date : ""}`;
    const n = Math.min(3, wrapWords(ctx, t, maxW).length);
    if (draw) drawParagraph(ctx, t, x, y + px, maxW, lh, false, 3);
    return n * lh;
  }
  ctx.font = `700 ${px}px Outfit`;
  const head = `${L.sources.replace(/\s*:\s*$/, "")}${date ? " · " + date : ""}`;
  if (draw) ctx.fillText(head, x, y + px);
  h += lh + 4;
  list.forEach((src) => {
    ctx.font = `500 ${px}px Outfit`;
    const n = Math.min(3, wrapWords(ctx, src, maxW - 28).length);
    if (draw) {
      ctx.fillStyle = BRICK;
      ctx.fillRect(x, y + h + px * 0.45, 10, 10);
      ctx.fillStyle = "#4a3a36";
      drawParagraph(ctx, src, x + 28, y + h + px, maxW - 28, lh, false, 3);
    }
    h += n * lh + 6;
  });
  return h;
}

// small source line at the bottom of the other pages (when switched on)
function footSource(ctx, d, kind) {
  if (kind === "cover" || kind === "essential" || !showSource(d, kind)) return;
  const line = sourceLine(d);
  if (!line) return;
  ctx.fillStyle = "#4a3a36";
  ctx.font = "500 20px Outfit";
  ctx.textAlign = "left";
  const two = wrapWords(ctx, line, MAXW).length > 1;
  drawParagraph(ctx, line, PAD, (kind === "takeaway" ? VH - 150 : VH - 125) - (two ? 26 : 0), MAXW, 26, false, 2);
}

// sections are made smaller when they would take too much of the page
function blocksFit(ctx, d, pos) {
  const blocks = blocksOf(d, pos);
  if (!blocks.length) return { h: 0, k: 1, blocks };
  let k = pageScale(d, CUR_KIND);
  const measure = () => 40 + blocks.reduce((h, b) => h + drawBlock(ctx, b, 0, k * elScale(d, `blk-${b.id}`), false) + BLOCK_GAP, 0);
  let h = measure();
  const maxH = blocks.some((b) => b.type === "offer") ? 700 : 460; // "Notre accompagnement" needs more room
  while (h > maxH && k > 0.55) { k -= 0.05; h = measure(); }
  return { h, k, blocks };
}
function blocksReserve(ctx, d) {
  return blocksFit(ctx, d, "bottom").h;
}
// sections placed at the top of the page (under its title); returns the room they take
function drawTopBlocks(ctx, d, y0) {
  const { h, k, blocks } = blocksFit(ctx, d, "top");
  if (!blocks.length) return 0;
  let y = y0 + 34; // breathing room under the page title
  blocks.forEach((b) => { y += withEl(ctx, d, `blk-${b.id}`, () => drawBlock(ctx, b, y, k * elScale(d, `blk-${b.id}`), true)) + BLOCK_GAP; });
  ctx.fillStyle = DOT;
  ctx.fillRect(PAD, y - 10, MAXW, 2);
  return h + 34;
}
function drawPageBlocks(ctx, d, bottom) {
  const { h, k, blocks } = blocksFit(ctx, d, "bottom");
  if (!blocks.length) return;
  let y = bottom - h + 20;
  ctx.fillStyle = DOT;
  ctx.fillRect(PAD, y, MAXW, 2);
  y += 30;
  blocks.forEach((b) => { y += withEl(ctx, d, `blk-${b.id}`, () => drawBlock(ctx, b, y, k * elScale(d, `blk-${b.id}`), true)) + BLOCK_GAP; });
}

// "Taille du texte" of one page (visual.page_text_scale[kind]), 0.7 – 1.4
function pageScale(d, kind) {
  const n = Number((d.v.page_text_scale || {})[kind]);
  return Number.isFinite(n) && n > 0 ? Math.max(0.7, Math.min(1.4, n)) : 1;
}

// Largest font (px) at which `text` fits inside maxW × availH, then the text actually shown
// (whole sentences only).
function fitBlock(ctx, text, weight, size, minSize, availH, lineRatio = 1.38, maxW = MAXW) {
  let px = size;
  for (; px >= minSize; px -= 2) {
    ctx.font = `${weight} ${px}px Outfit`;
    if (wrapWords(ctx, text, maxW).length * px * lineRatio <= availH) break;
  }
  px = Math.max(px, minSize);
  ctx.font = `${weight} ${px}px Outfit`;
  const lh = Math.round(px * lineRatio);
  const maxLines = Math.max(1, Math.floor(availH / lh));
  return { px, lh, text: fitSentences(ctx, text, maxW, maxLines), maxLines };
}

function miniHeader(ctx, images, n, total) {
  ctx.fillStyle = BLUSH;
  ctx.fillRect(0, 0, VW, VH);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const label = String(currentTemplate().bannerText || "").trim().slice(0, 24);
  const bs = tplScale("bannerScale");
  const bh = Math.round(70 * bs);
  deco(ctx, CUR_D, "banner", PAD, 60, () => drawBanner(ctx, label, PAD, 60, bh, Math.round(56 * bs))); // template's banner shape
  const logo = images?.logoImg;
  let lh = 0;
  if (logo) {
    lh = 60 * tplScale("logoScale");
    let lw = (logo.width / logo.height) * lh;
    if (lw > 520) { lw = 520; lh = lw * (logo.height / logo.width); }
    deco(ctx, CUR_D, "logo", VW - PAD, 64, () => ctx.drawImage(logo, VW - PAD - lw, 64, lw, lh));
  }
  pageCounter(ctx, n, total);
  // the page content starts under whichever is taller
  return Math.max(200, 60 + bh + 70, 64 + lh + 66);
}

function pageCounter(ctx, n, total) {
  endShift(ctx);
  ctx.textAlign = "right";
  ctx.fillStyle = "#8a6a62";
  ctx.font = "600 26px Outfit";
  deco(ctx, CUR_D, "pageNum", VW - PAD, VH - 70, () => ctx.fillText(`${n} / ${total}`, VW - PAD, VH - 70));
  ctx.textAlign = "left";
}

function swipeHint(ctx, label = L.swipe) {
  endShift(ctx);
  ctx.fillStyle = BRICK;
  ctx.font = "700 30px Outfit";
  ctx.textAlign = "left";
  deco(ctx, CUR_D, "swipe", PAD, VH - 70, () => ctx.fillText(ellipsize(ctx, `${label}  →`, MAXW - 160), PAD, VH - 70));
}

// Page title: wraps (and honours typed line breaks) and shrinks so it never leaves the page.
// Returns the extra height it takes beyond one line, so the page content moves down accordingly.
function bigLabel(ctx, text, y, s = 1) {
  const fam = titleFontFamily();
  const w = MAXW - 34;
  let px = Math.round(44 * s);
  ctx.font = `800 ${px}px ${fam}`;
  while (px > 28 * Math.min(1, s) && wrapWords(ctx, text, w).length > 2) { px -= 2; ctx.font = `800 ${px}px ${fam}`; }
  const lh = Math.round(px * 1.18);
  const lines = Math.min(5, wrapWords(ctx, text, w).length);
  ctx.fillStyle = BRICK;
  ctx.fillRect(PAD, y - Math.round(px * 0.77), 14, Math.round(px * 0.9));
  ctx.fillStyle = BORDEAUX;
  drawParagraph(ctx, text, PAD + 34, y, w, lh, false, 5);
  return Math.max(0, (lines - 1) * lh);
}

// Two columns side by side, each with a bold title and its text (the shorter one is centred
// vertically against the taller one). Returns the height (draw = false only measures).
function drawColumns(ctx, b, y, k, draw, x0 = PAD, w = MAXW) {
  const gap = Math.round(56 * Math.min(1, k));
  const cw = (w - gap) / 2;
  const tPx = Math.round(32 * k);
  const bPx = Math.round(30 * k);
  const tLh = Math.round(tPx * 1.3);
  const bLh = Math.round(bPx * 1.38);
  const col = (title, text) => {
    ctx.font = `700 ${tPx}px Outfit`;
    const tl = title ? Math.min(4, wrapWords(ctx, title, cw).length) : 0;
    ctx.font = `400 ${bPx}px Outfit`;
    const bl = text ? Math.min(12, wrapWords(ctx, text, cw).length) : 0;
    return { title, text, tl, bl, h: tl * tLh + (tl && bl ? 6 : 0) + bl * bLh };
  };
  const cols = [col(clean(b.col1t), clean(b.col1)), col(clean(b.col2t), clean(b.col2))];
  const h = Math.max(cols[0].h, cols[1].h);
  if (draw) {
    cols.forEach((c, i) => {
      const cx = x0 + i * (cw + gap);
      let cy = y + (h - c.h) / 2;
      if (c.tl) {
        ctx.fillStyle = BORDEAUX;
        ctx.font = `700 ${tPx}px Outfit`;
        drawParagraph(ctx, c.title, cx, cy + tPx, cw, tLh, false, 4);
        cy += c.tl * tLh + 6;
      }
      if (c.bl) {
        ctx.fillStyle = INK;
        ctx.font = `400 ${bPx}px Outfit`;
        drawParagraph(ctx, c.text, cx, cy + bPx, cw, bLh, false, 12);
      }
    });
    // thin divider between the two columns
    ctx.fillStyle = DOT;
    ctx.fillRect(x0 + cw + gap / 2 - 1, y, 2, h);
  }
  return h;
}

// ---------- "Notre accompagnement": FORSIDES services, each with a drawn icon ----------
// icon picked from the service name (diagnostic, sinistralité, simulation, recommandations…)
function iconKind(title, i) {
  const t = String(title || "").toLowerCase();
  if (/diagnost|contrat|contractuel|audit|clause|revue/.test(t)) return "doc";
  if (/sinistr|analyse|statist|donn|suivi|tableau/.test(t)) return "chart";
  if (/simul|financ|chiffr|calcul|tarif|provision|ratio|co[uû]t/.test(t)) return "calc";
  if (/recommand|prospect|conseil|strat|pilot|d[ée]cision/.test(t)) return "bulb";
  return ["doc", "chart", "calc", "bulb"][i % 4];
}
function drawIcon(ctx, kind, x, y, size, color) {
  const u = size / 24; // drawn on a 24-unit grid, like a line icon
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(u, u);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (kind === "doc") {
    ctx.moveTo(15, 3); ctx.lineTo(6, 3); ctx.quadraticCurveTo(4, 3, 4, 5); ctx.lineTo(4, 19); ctx.quadraticCurveTo(4, 21, 6, 21);
    ctx.lineTo(11, 21); ctx.moveTo(15, 3); ctx.lineTo(19, 7); ctx.lineTo(19, 11); ctx.moveTo(15, 3); ctx.lineTo(15, 7); ctx.lineTo(19, 7);
    ctx.moveTo(8, 10); ctx.lineTo(14, 10); ctx.moveTo(8, 14); ctx.lineTo(11, 14);
    ctx.stroke(); ctx.beginPath(); ctx.arc(16.5, 16.5, 3, 0, Math.PI * 2); ctx.moveTo(18.7, 18.7); ctx.lineTo(21, 21); ctx.stroke();
  } else if (kind === "chart") {
    ctx.moveTo(3, 3); ctx.lineTo(3, 21); ctx.lineTo(21, 21);
    ctx.moveTo(7, 16); ctx.lineTo(11, 11); ctx.lineTo(14, 14); ctx.lineTo(20, 7); ctx.moveTo(16, 7); ctx.lineTo(20, 7); ctx.lineTo(20, 11);
    ctx.stroke();
  } else if (kind === "calc") {
    roundRect(ctx, 5, 2, 14, 20, 2); ctx.stroke();
    ctx.beginPath(); ctx.rect(8, 5, 8, 4); ctx.stroke();
    [[9, 13], [12, 13], [15, 13], [9, 16.5], [12, 16.5], [15, 16.5], [9, 19.5], [12, 19.5], [15, 19.5]].forEach(([cx, cy]) => {
      ctx.beginPath(); ctx.arc(cx, cy, 0.9, 0, Math.PI * 2); ctx.fill();
    });
  } else {
    ctx.arc(12, 9.5, 6, Math.PI * 0.8, Math.PI * 2.2); ctx.moveTo(9, 15.5); ctx.lineTo(9, 18); ctx.lineTo(15, 18); ctx.lineTo(15, 15.5);
    ctx.moveTo(10, 21); ctx.lineTo(14, 21); ctx.moveTo(12, 1); ctx.lineTo(12, 2); ctx.moveTo(3, 9.5); ctx.lineTo(4, 9.5); ctx.moveTo(20, 9.5); ctx.lineTo(21, 9.5);
    ctx.stroke();
  }
  ctx.restore();
}
// x: { intro, text (one service per line, "Titre : description"), cta }; returns the height
function drawOffer(ctx, x, y, k, draw, { withCta = true } = {}) {
  const intro = clean(x.intro);
  const items = String(x.text || "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 6).map((l) => {
    const m = l.match(/^(.{2,60}?)\s*:\s+(.+)$/);
    return m ? { t: m[1].trim(), d: m[2].trim() } : { t: l, d: "" };
  });
  const cta = withCta ? clean(x.cta) : "";
  let h = 0;
  if (intro) {
    const px = Math.round(34 * k);
    ctx.font = `600 ${px}px Outfit`;
    const lh = Math.round(px * 1.32);
    const n = Math.min(5, wrapWords(ctx, intro, MAXW).length);
    if (draw) { ctx.fillStyle = BORDEAUX; drawParagraph(ctx, intro, PAD, y + px, MAXW, lh, false, 5); }
    h += n * lh + Math.round(44 * k);
  }
  const box = Math.round(84 * k);
  const tx = PAD + box + Math.round(30 * k);
  const tw = VW - PAD - tx;
  const tPx = Math.round(32 * k);
  const dPx = Math.round(27 * k);
  items.forEach((it, i) => {
    ctx.font = `700 ${tPx}px Outfit`;
    const tl = Math.min(2, wrapWords(ctx, it.t, tw).length);
    ctx.font = `400 ${dPx}px Outfit`;
    const dl = it.d ? Math.min(4, wrapWords(ctx, it.d, tw).length) : 0;
    const textH = tl * Math.round(tPx * 1.25) + (dl ? 8 + dl * Math.round(dPx * 1.38) : 0);
    const rowH = Math.max(box, textH);
    if (draw) {
      const iy = y + h + (rowH - box) / 2;
      ctx.fillStyle = BRICK;
      roundRect(ctx, PAD, iy, box, box, Math.round(box * 0.24)); ctx.fill();
      drawIcon(ctx, iconKind(it.t, i), PAD + box * 0.2, iy + box * 0.2, box * 0.6, "#ffffff");
      let ty = y + h + (rowH - textH) / 2;
      ctx.fillStyle = INK;
      ctx.font = `700 ${tPx}px Outfit`;
      drawParagraph(ctx, it.t, tx, ty + tPx, tw, Math.round(tPx * 1.25), false, 2);
      ty += tl * Math.round(tPx * 1.25) + 8;
      if (dl) {
        ctx.fillStyle = "#4a3a36";
        ctx.font = `400 ${dPx}px Outfit`;
        drawParagraph(ctx, it.d, tx, ty + dPx, tw, Math.round(dPx * 1.38), false, 4);
      }
      if (i < items.length - 1) { ctx.fillStyle = DOT; ctx.fillRect(tx, y + h + rowH + Math.round(18 * k), tw, 2); }
    }
    h += rowH + Math.round(36 * k);
  });
  if (cta) {
    const px = Math.round(30 * k);
    ctx.font = `700 ${px}px Outfit`;
    const w = Math.min(MAXW, ctx.measureText(cta).width + px * 2);
    const bh = Math.round(px * 2.1);
    h += Math.round(10 * k);
    if (draw) {
      ctx.fillStyle = BRICK;
      roundRect(ctx, PAD, y + h, w, bh, bh / 2); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(ellipsize(ctx, cta, w - px * 2), PAD + px, y + h + bh / 2 + px * 0.36);
    }
    h += bh;
  }
  return h;
}

// ---------- pages ----------
function coverPage(ctx, d, images, n, total) {
  const top = drawHeader(ctx, d.post, images, (id, ax, ay, fn) => deco(ctx, d, id, ax, ay, fn));
  beginShift(ctx, d);
  const withSrc = d.content.source && showSource(d, "cover");
  let srcPx = Math.round(30 * elScale(d, "source"));
  let srcH = withSrc ? sourceBlock(ctx, d, PAD, 0, MAXW, srcPx, false) : 0;
  while (srcH > 330 && srcPx > 18) { srcPx -= 2; srcH = sourceBlock(ctx, d, PAD, 0, MAXW, srcPx, false); }
  // the title area ends above the sources (several long sources make the title a little smaller)
  const res = blocksReserve(ctx, d);
  const titleOn = !isHidden(d, "cover.title");
  const area = { top: Math.max(top + 140, 360), bottom: Math.min(VH - 360, VH - 190 - (withSrc ? srcH + 64 : 0)) - res };
  area.top += drawTopBlocks(ctx, d, Math.max(top + 60, 280));
  ctx.fillStyle = BORDEAUX;
  let px = Math.round(84 * pageScale(d, "cover") * elScale(d, "title"));
  const fam = titleFontFamily();
  ctx.font = `800 ${px}px ${fam}`;
  // a long title (or one with line breaks) gets smaller until it fits in the page
  while (px > 26 && wrapWords(ctx, d.title, MAXW).length * px * 1.18 > area.bottom - area.top) {
    px -= 2;
    ctx.font = `800 ${px}px ${fam}`;
  }
  const lh = Math.round(px * 1.18);
  const maxLines = Math.max(1, Math.floor((area.bottom - area.top) / lh));
  const lines = Math.min(maxLines, wrapWords(ctx, d.title, MAXW).length);
  const y0 = area.top + Math.max(0, ((area.bottom - area.top) - lines * lh) / 2) + px;
  let yEnd = area.top;
  if (titleOn) {
    yEnd = withEl(ctx, d, "title", () => {
      ctx.fillStyle = BORDEAUX;
      ctx.font = `800 ${px}px ${fam}`;
      const e = drawParagraph(ctx, d.title, PAD, y0, MAXW, lh, false, maxLines);
      drawRule(ctx, e + 10);
      return e;
    }) + elDy(d, "title"); // the sources follow the title
  }
  if (withSrc) withEl(ctx, d, "source", () => sourceBlock(ctx, d, PAD, yEnd + 40, MAXW, srcPx, true));
  drawPageBlocks(ctx, d, VH - 150);
  swipeHint(ctx);
  pageCounter(ctx, n, total);
}

// Page 2: key figure + summary + a few facts, sized up and centred so the page is never half empty.
function essentialPage(ctx, d, images, n, total) {
  const k = pageScale(d, "essential");
  let top = miniHeader(ctx, images, n, total);
  beginShift(ctx, d);
  top += heading(ctx, d, L.essential, top + 90);
  const areaTop = top + 150 + drawTopBlocks(ctx, d, top + 130);
  const RB = VH - 170;
  const areaBottom = RB - blocksReserve(ctx, d);
  const fig = isHidden(d, "essential.figure") ? "" : clean(d.v.key_figure_value);
  const figLabel = isHidden(d, "essential.figure") ? "" : clean(d.v.key_figure_label);
  // short facts not already shown on the "chiffres" page
  const facts = d.factsFree && !isHidden(d, "essential.facts") ? (d.v.data_points || []).map(clean).filter(Boolean).slice(0, 3) : [];
  const summaryOn = !isHidden(d, "essential.summary");
  const sFig = elScale(d, "figure");
  const sSum = elScale(d, "summary");
  const sFacts = elScale(d, "facts");
  const sSrc = elScale(d, "source");
  const src = showSource(d, "essential") ? sourceLine(d) : "";

  // measure everything at a given summary size, then pick the largest size that fits
  const layout = (sumPx) => {
    let h = 0;
    const parts = [];
    if (fig) {
      ctx.font = `${Math.round(190 * k * sFig)}px Anton`;
      const px = fitFontSize(ctx, fig, "Anton", Math.round(190 * k * sFig), MAXW, 60);
      parts.push({ k: "fig", px, h: px });
      h += px;
      if (figLabel) {
        ctx.font = `500 ${Math.round(34 * sFig)}px Outfit`;
        const lines = Math.min(3, wrapWords(ctx, figLabel, MAXW).length);
        parts.push({ k: "figLabel", lines, h: 20 + lines * 46 * sFig });
        h += 20 + lines * 46 * sFig;
      }
      h += 50;
    }
    if (d.content.summary && summaryOn) {
      ctx.font = `400 ${sumPx}px Outfit`;
      const lh = Math.round(sumPx * 1.38);
      const lines = wrapWords(ctx, d.content.summary, MAXW).length;
      parts.push({ k: "sum", px: sumPx, lh, lines, h: lines * lh });
      h += lines * lh;
    }
    if (facts.length) {
      ctx.font = `600 ${Math.round(34 * sFacts)}px Outfit`;
      const fh = facts.reduce((a, f) => a + Math.min(2, wrapWords(ctx, f, MAXW - 50).length) * 44 * sFacts + 22, 0);
      parts.push({ k: "facts", h: 60 + fh });
      h += 60 + fh;
    }
    if (src) { const sh = 70 + sourceBlock(ctx, d, PAD, 0, MAXW, Math.round(24 * sSrc), false); parts.push({ k: "src", h: sh }); h += sh; }
    return { h, parts };
  };
  let sumPx = Math.round(64 * k * sSum);
  let lay = layout(sumPx);
  while (sumPx > 30 * Math.min(1, sSum) && lay.h > areaBottom - areaTop) { sumPx -= 2; lay = layout(sumPx); }

  const fitE = lay.h > areaBottom - areaTop ? Math.max(0.5, (areaBottom - areaTop) / lay.h) : 1;
  ctx.save();
  if (fitE < 1) { ctx.translate(PAD, areaTop); ctx.scale(fitE, fitE); ctx.translate(-PAD, -areaTop); }
  let y = areaTop + Math.max(0, (areaBottom - areaTop - lay.h) / 2); // centred block
  const PART_EL = { fig: "figure", figLabel: "figure", sum: "summary", facts: "facts", src: "source" };
  lay.parts.forEach((p) => withEl(ctx, d, PART_EL[p.k], () => {
    if (p.k === "fig") {
      ctx.fillStyle = BRICK;
      ctx.font = `${p.px}px Anton`;
      ctx.fillText(fig, PAD, y + p.px * 0.85);
      y += p.px;
    } else if (p.k === "figLabel") {
      ctx.fillStyle = INK;
      ctx.font = `500 ${Math.round(34 * sFig)}px Outfit`;
      drawParagraph(ctx, figLabel, PAD, y + 20 + 34 * sFig, MAXW, 46 * sFig, false, 3);
      y += p.h + 50;
    } else if (p.k === "sum") {
      if (!fig) y += 0;
      ctx.fillStyle = INK;
      ctx.font = `400 ${p.px}px Outfit`;
      drawParagraph(ctx, d.content.summary, PAD, y + p.px, MAXW, p.lh, false, p.lines);
      y += p.h;
    } else if (p.k === "facts") {
      y += 60;
      facts.forEach((f, i) => {
        drawBullet(ctx, PAD, y + 8, 18, i % 2 === 0 ? BRICK : CORAL);
        ctx.fillStyle = BORDEAUX;
        ctx.font = `600 ${Math.round(34 * sFacts)}px Outfit`;
        const end = drawParagraph(ctx, f, PAD + 50, y + 30 * sFacts, MAXW - 50, 44 * sFacts, false, 2);
        y = end - 44 * sFacts + 22 + 14;
      });
    } else if (p.k === "src") {
      drawRule(ctx, y + 40);
      sourceBlock(ctx, d, PAD, y + 62, MAXW, Math.round(24 * sSrc), true);
      y += p.h;
    }
  }));
  ctx.restore();
  drawPageBlocks(ctx, d, RB);
  swipeHint(ctx);
}

function dataPage(ctx, d, images, n, total) {
  const k = pageScale(d, "data");
  const res = blocksReserve(ctx, d);
  let top = miniHeader(ctx, images, n, total);
  beginShift(ctx, d);
  const chart = d.v.chart;
  if (hasChart(d.post)) {
    // chart sized to what it needs, its reading sentence in full, then the key facts;
    // the whole block is centred so the page is never half empty
    top += heading(ctx, d, L.figures, top + 90);
    const areaTop = top + 135 + drawTopBlocks(ctx, d, top + 125);
    const areaBottom = VH - 170 - res;
    const ctitle = isHidden(d, "data.chartTitle") ? "" : clean(chart.title).toUpperCase();
    const note = isHidden(d, "data.note") ? "" : clean(chart.note);
    const facts = isHidden(d, "data.facts") ? [] : (d.v.data_points || []).map(clean).filter(Boolean).slice(0, 3);
    const chartOn = !isHidden(d, "data.chart");
    const sCT = elScale(d, "chartTitle");
    const sChart = elScale(d, "chart");
    const sNote = elScale(d, "note");
    const sFacts = elScale(d, "facts");
    const vertical = chart.type !== "pie" && chart.items.every((i) => /^(\d{4}|[TSQH]\d[\s-]?\d{2,4}|\d{4}[\s-]\d{2,4})$/i.test(String(i.label).trim()));
    // few bars → taller rows so the chart fills the page instead of leaving a hole
    const rowMax = chart.items.length <= 3 ? 190 : 150;
    const natural = Math.round((!chartOn ? 0 : chart.type === "pie" || vertical ? 600 : Math.max(260, chart.items.length * rowMax)) * sChart);
    const avail = areaBottom - areaTop;

    const measure = (notePx, chartH, factPx) => {
      let h = 0;
      ctx.font = `600 ${Math.round(22 * sCT)}px Outfit`;
      const tl = ctitle ? Math.min(2, wrapWords(ctx, ctitle, MAXW).length) : 0;
      h += tl ? tl * 32 * sCT + 26 : 0;
      h += chartH;
      ctx.font = `italic 500 ${notePx}px Outfit`;
      const nl = note ? wrapWords(ctx, note, MAXW).length : 0;
      h += nl ? 50 + nl * Math.round(notePx * 1.35) : 0;
      ctx.font = `600 ${factPx}px Outfit`;
      const flh = Math.round(factPx * 1.32);
      const fh = facts.reduce((a, f) => a + Math.min(2, wrapWords(ctx, f, MAXW - 50).length) * flh + 20, 0);
      h += facts.length ? 60 + fh : 0;
      return { h, tl, nl, flh };
    };
    let notePx = Math.round(34 * k * sNote);
    let factPx = Math.round(32 * k * sFacts);
    let chartH = natural;
    let m = measure(notePx, chartH, factPx);
    while (m.h > avail && notePx > 22 * Math.min(1, sNote)) { notePx -= 2; m = measure(notePx, chartH, factPx); }
    while (chartOn && m.h > avail && chartH > 220 * Math.min(1, sChart)) { chartH -= 20; m = measure(notePx, chartH, factPx); }
    // room left: enlarge the reading sentence and the facts a little
    while (notePx < 40 * k * sNote && measure(notePx + 2, chartH, factPx).h <= avail) { notePx += 2; m = measure(notePx, chartH, factPx); }
    while (factPx < 38 * k * sFacts && measure(notePx, chartH, factPx + 2).h <= avail) { factPx += 2; m = measure(notePx, chartH, factPx); }
    // whatever is still free is spread between the sections (not above the chart), the rest stays at the bottom
    const free = Math.max(0, avail - m.h);
    const gaps = (m.nl ? 1 : 0) + (facts.length ? 1 : 0);
    const gapExtra = gaps ? Math.min(90, free / (gaps + 1)) : 0;

    // still too tall (many facts + added sections): the whole block is scaled down to fit
    const fitF = m.h > avail ? Math.max(0.5, avail / m.h) : 1;
    ctx.save();
    if (fitF < 1) { ctx.translate(PAD, areaTop); ctx.scale(fitF, fitF); ctx.translate(-PAD, -areaTop); }
    let y = areaTop;
    if (m.tl) {
      withEl(ctx, d, "chartTitle", () => {
        ctx.fillStyle = "#8a6a62";
        ctx.font = `600 ${Math.round(22 * sCT)}px Outfit`;
        const prev = ctx.letterSpacing;
        ctx.letterSpacing = "3px";
        wrapWords(ctx, ctitle, MAXW).slice(0, 2).forEach((ln, i) => ctx.fillText(ln.join(" "), PAD, y + 22 * sCT + i * 32 * sCT));
        ctx.letterSpacing = prev || "0px";
      });
      y += m.tl * 32 * sCT + 26;
    }
    if (!chartOn) { /* chart removed by the user */ }
    else withEl(ctx, d, "chart", () => {
      if (chart.type === "pie") drawPieChart(ctx, chart, PAD, y, MAXW, chartH);
      else drawBarChart(ctx, chart, PAD, y, MAXW, chartH, { rowMax: Math.round(rowMax * sChart) });
    });
    y += chartH;
    if (m.nl) {
      y += gapExtra;
      withEl(ctx, d, "note", () => {
        ctx.fillStyle = "#4a3a36";
        ctx.font = `italic 500 ${notePx}px Outfit`;
        drawParagraph(ctx, note, PAD, y + 50 + notePx, MAXW, Math.round(notePx * 1.35), false, m.nl);
      });
      y += 50 + m.nl * Math.round(notePx * 1.35);
    }
    if (facts.length) {
      y += 60 + gapExtra;
      const fdy = elDy(d, "facts");
      y += fdy;
      const tf = startTrack(elKey("facts"));
      facts.forEach((f, i) => {
        drawBullet(ctx, PAD, y + 6, 18, i % 2 === 0 ? BRICK : CORAL);
        ctx.fillStyle = BORDEAUX;
        ctx.font = `600 ${factPx}px Outfit`;
        const end = drawParagraph(ctx, f, PAD + 50, y + factPx - 4, MAXW - 50, m.flh, false, 2);
        y = end - m.flh + 20 + 14;
      });
      endTrack(tf);
      y -= fdy;
    }
    ctx.restore();
  } else {
    top += heading(ctx, d, L.keyFigures, top + 90);
    let y = top + 190 + drawTopBlocks(ctx, d, top + 140);
    const items = isHidden(d, "data.facts") ? [] : (d.v.data_points || []).map(clean).filter(Boolean).slice(0, 4);
    const date = isHidden(d, "data.date") ? "" : clean(d.v.important_date);
    if (date) {
      const sD = elScale(d, "date");
      const px = fitFontSize(ctx, date, "Anton", Math.round(130 * sD), MAXW, 50);
      withEl(ctx, d, "date", () => {
        ctx.fillStyle = CORAL;
        ctx.font = `${px}px Anton`;
        ctx.fillText(date, PAD, y + px * 0.85);
        ctx.fillStyle = INK;
        ctx.font = `500 ${Math.round(32 * sD)}px Outfit`;
        ctx.fillText(L.deadline, PAD, y + px + 30);
      });
      y += px + 110;
    }
    y += elDy(d, "facts");
    const avail = VH - 220 - res - y;
    const per = items.length ? avail / items.length : 0;
    const ti = startTrack(elKey("facts"));
    items.forEach((t, i) => {
      ctx.fillStyle = i % 2 === 0 ? BRICK : CORAL;
      drawBullet(ctx, PAD, y + 8, 18, ctx.fillStyle);
      const b = fitBlock(ctx, t, 600, Math.round(44 * k * elScale(d, "facts")), 22, per - 30, 1.3, MAXW - 50);
      ctx.fillStyle = INK;
      drawParagraph(ctx, b.text, PAD + 50, y + b.px * 0.8, MAXW - 50, b.lh, false, b.maxLines);
      y += per;
    });
    endTrack(ti);
  }
  drawPageBlocks(ctx, d, VH - 170);
  swipeHint(ctx);
}

function pointsPage(ctx, d, images, n, total, points, pageTitle) {
  const k = pageScale(d, "points");
  let top = miniHeader(ctx, images, n, total);
  beginShift(ctx, d);
  top += heading(ctx, d, pageTitle, top + 90);
  let y = top + 180 + drawTopBlocks(ctx, d, top + 140);
  const res = blocksReserve(ctx, d);
  const per = (VH - 220 - res - y) / points.length;
  const pid = (p) => `pt-${d.content.points.indexOf(p)}`;
  const valH = (p) => (p.value ? fitFontSize(ctx, p.value, "Anton", Math.round(120 * k * elScale(d, pid(p))), MAXW, 50) + 20 : 0);
  // common size: the largest that fits every point, so the points look alike
  const common = Math.min(...points.map((p) => (p.text ? fitBlock(ctx, p.text, 600, Math.round(54 * k), 24, per - 90 - valH(p)).px : 999)));
  points.forEach((p, i) => {
    const sp = elScale(d, pid(p));
    withEl(ctx, d, pid(p), () => {
      drawLabel(ctx, p.label.toUpperCase(), PAD, y);
      let fy = 0;
      if (p.value) { // "chiffre clé" section
        ctx.fillStyle = BRICK;
        const px = fitFontSize(ctx, p.value, "Anton", Math.round(120 * k * sp), MAXW, 50);
        ctx.fillText(p.value, PAD, y + 30 + px * 0.9);
        fy = px + 20;
      }
      ctx.fillStyle = i % 2 === 0 ? BORDEAUX : INK;
      const b = fitBlock(ctx, p.text, 600, Math.round(Math.min(common, 54 * k) * sp), 20, per - 90 - fy + (sp > 1 ? 400 : 0));
      if (p.text) drawParagraph(ctx, b.text, PAD, y + 30 + fy + b.px, MAXW, b.lh, false, b.maxLines);
    });
    if (i < points.length - 1) {
      const sy = y + per - 40;
      deco(ctx, d, "separators", PAD, sy, () => { ctx.fillStyle = DOT; ctx.fillRect(PAD, sy, MAXW, 2); });
    }
    y += per;
  });
  drawPageBlocks(ctx, d, VH - 180);
  swipeHint(ctx);
}

function takeawayPage(ctx, d, images, n, total) {
  let top = miniHeader(ctx, images, n, total);
  beginShift(ctx, d);
  top += heading(ctx, d, L.takeaway, top + 90);
  // quotes are drawn by the page itself (opening and closing), so strip any typed in the text
  const text = isHidden(d, "takeaway.quote") ? "" : String(d.takeaway || "").replace(/^[\s«»“”"']+|[\s«»“”"']+$/g, "");
  const ctaOn = !isHidden(d, "takeaway.cta");
  const area = { top: top + 175, bottom: (ctaOn ? VH - 440 : VH - 200) - blocksReserve(ctx, d) };
  area.top += drawTopBlocks(ctx, d, top + 140);
  const QH = 120; // room taken by each quote mark
  const b = fitBlock(ctx, text, 700, Math.round(64 * pageScale(d, "takeaway") * elScale(d, "quote")), 24, area.bottom - area.top - QH * 2, 1.25);
  const lines = Math.min(b.maxLines, wrapWords(ctx, b.text, MAXW).length);
  // when the last line reaches the right edge, the closing quote goes a little lower so it never covers the text
  ctx.font = `700 ${b.px}px Outfit`;
  const lastLn = (wrapWords(ctx, b.text, MAXW)[lines - 1] || []).join(" ");
  const qDrop = PAD + ctx.measureText(lastLn).width > VW - PAD - 150 ? 80 : 0;
  const blockH = QH + lines * b.lh + QH + qDrop;
  // the quote + text block is centred in the free space, so there is no hole under the opening quote
  const y0 = area.top + Math.max(0, (area.bottom - area.top - blockH) / 2);
  if (text) withEl(ctx, d, "quote", () => {
  deco(ctx, d, "quoteOpen", PAD, y0 + 60, () => { ctx.fillStyle = BRICK; ctx.font = "220px Anton"; ctx.fillText("“", PAD - 10, y0 + 175); });
  ctx.fillStyle = BORDEAUX;
  ctx.font = `700 ${b.px}px Outfit`;
  drawParagraph(ctx, b.text, PAD, y0 + QH + b.px, MAXW, b.lh, false, b.maxLines);
  const cqY = y0 + QH + lines * b.lh + 175 + qDrop;
  deco(ctx, d, "quoteClose", VW - PAD, cqY - 110, () => {
    ctx.fillStyle = BRICK; ctx.font = "220px Anton"; ctx.textAlign = "right";
    ctx.fillText("”", VW - PAD + 10, cqY);
    ctx.textAlign = "left";
  });
  });
  drawPageBlocks(ctx, d, ctaOn ? VH - 420 : VH - 180);
  endShift(ctx); // the closing question stays in place
  if (!ctaOn) {
    if (!isHidden(d, "takeaway.signature")) deco(ctx, d, "signature", VW / 2, VH - 78, () => drawSignature(ctx));
    return;
  }
  deco(ctx, d, "rule", PAD, VH - 400, () => drawRule(ctx, VH - 400));
  // closing texts wrap (2 lines max each) instead of running off the page
  const sC = elScale(d, "cta");
  withEl(ctx, d, "cta", () => {
    ctx.fillStyle = INK;
    ctx.font = `600 ${Math.round(34 * sC)}px Outfit`;
    const qEnd = drawParagraph(ctx, clean(d.v.cta_question) || L.ctaQ, PAD, VH - 320, MAXW, Math.round(42 * sC), false, 2);
    ctx.fillStyle = "#4a3a36";
    ctx.font = `400 ${Math.round(30 * sC)}px Outfit`;
    drawParagraph(ctx, clean(d.v.cta_text) || L.cta, PAD, Math.max(VH - 270, qEnd + 8), MAXW, Math.round(38 * sC), false, 2);
  });
  if (!isHidden(d, "takeaway.signature")) deco(ctx, d, "signature", VW / 2, VH - 78, () => drawSignature(ctx));
}

// Page added by the user ("Ajouter une page"): texte, chiffre clé, citation or liste
function extraPage(ctx, d, images, n, total, x) {
  const k = pageScale(d, `extra-${x.id}`) * elScale(d, "body");
  let top = miniHeader(ctx, images, n, total);
  beginShift(ctx, d);
  const title = clean(x.title);
  if (title) top += heading(ctx, d, title, top + 90);
  const areaTop = top + (title ? 170 : 90) + drawTopBlocks(ctx, d, top + (title ? 150 : 80));
  const areaBottom = VH - 200 - blocksReserve(ctx, d);
  const avail = areaBottom - areaTop;
  const text = clean(x.text);
  const type = x.type || "text";
  ctx.save(); // the page body moves with its own "Position"
  const bodyDy = elDy(d, "body");
  if (bodyDy) ctx.translate(0, bodyDy);
  const tb = startTrack(elKey("body"));

  if (type === "figure") {
    const value = clean(x.value);
    const label = clean(x.label);
    const vpx = value ? fitFontSize(ctx, value, "Anton", Math.round(230 * k), MAXW, 80) : 0;
    ctx.font = `600 ${Math.round(40 * k)}px Outfit`;
    const lLines = label ? Math.min(3, wrapWords(ctx, label, MAXW).length) : 0;
    const llh = Math.round(40 * k * 1.3);
    const rest = avail - vpx - lLines * llh - 80;
    const b = text ? fitBlock(ctx, text, 400, Math.round(36 * k), 24, Math.max(60, rest)) : null;
    const tLines = b ? Math.min(b.maxLines, wrapWords(ctx, b.text, MAXW).length) : 0;
    const h = vpx + (lLines ? 30 + lLines * llh : 0) + (tLines ? 50 + tLines * b.lh : 0);
    let y = areaTop + Math.max(0, (avail - h) / 2);
    if (value) { ctx.fillStyle = BRICK; ctx.font = `${vpx}px Anton`; ctx.fillText(value, PAD, y + vpx * 0.85); y += vpx; }
    if (lLines) {
      ctx.fillStyle = BORDEAUX;
      ctx.font = `600 ${Math.round(40 * k)}px Outfit`;
      drawParagraph(ctx, label, PAD, y + 30 + 40 * k, MAXW, llh, false, 3);
      y += 30 + lLines * llh;
    }
    if (tLines) {
      drawRule(ctx, y + 20);
      ctx.fillStyle = INK;
      ctx.font = `400 ${b.px}px Outfit`;
      drawParagraph(ctx, b.text, PAD, y + 50 + b.px, MAXW, b.lh, false, b.maxLines);
    }
  } else if (type === "quote") {
    const q = text.replace(/^[\s«»“”"']+|[\s«»“”"']+$/g, "");
    const author = clean(x.label);
    const QH = 120;
    const b = fitBlock(ctx, q, "italic 600", Math.round(56 * k), 28, avail - QH - (author ? 90 : 0));
    const lines = Math.min(b.maxLines, wrapWords(ctx, b.text, MAXW).length);
    const h = QH + lines * b.lh + (author ? 90 : 0);
    const y0 = areaTop + Math.max(0, (avail - h) / 2);
    ctx.fillStyle = BRICK;
    ctx.font = "220px Anton";
    ctx.fillText("“", PAD - 10, y0 + 175);
    ctx.fillStyle = BORDEAUX;
    ctx.font = `italic 600 ${b.px}px Outfit`;
    const end = drawParagraph(ctx, b.text, PAD, y0 + QH + b.px, MAXW, b.lh, false, b.maxLines);
    if (author) {
      ctx.fillStyle = "#4a3a36";
      ctx.font = "600 32px Outfit";
      ctx.fillText(`— ${author}`, PAD, end + 40);
    }
  } else if (type === "offer") {
    // as large as the page allows, centred
    let kk = k * 1.15;
    let oh = drawOffer(ctx, x, 0, kk, false);
    while (oh > avail && kk > 0.55) { kk -= 0.05; oh = drawOffer(ctx, x, 0, kk, false); }
    drawOffer(ctx, x, areaTop + Math.max(0, (avail - oh) / 2), kk, true);
  } else if (type === "columns") {
    // bigger on a page of its own, fitted to the space and centred
    let kk = k * 1.25;
    let ch = drawColumns(ctx, x, 0, kk, false);
    while (ch > avail && kk > 0.6) { kk -= 0.05; ch = drawColumns(ctx, x, 0, kk, false); }
    drawColumns(ctx, x, areaTop + Math.max(0, (avail - ch) / 2), kk, true);
  } else if (type === "list") {
    const items = text.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, 8);
    const per = items.length ? avail / items.length : 0;
    let y = areaTop + 10;
    items.forEach((t, i) => {
      const b = fitBlock(ctx, t, 600, Math.round(44 * k), 24, Math.min(per - 30, 260), 1.3, MAXW - 50);
      const lines = Math.min(b.maxLines, wrapWords(ctx, b.text, MAXW - 50).length);
      drawBullet(ctx, PAD, y + b.px * 0.2, 18, i % 2 === 0 ? BRICK : CORAL);
      ctx.fillStyle = INK;
      ctx.font = `600 ${b.px}px Outfit`;
      drawParagraph(ctx, b.text, PAD + 50, y + b.px * 0.8, MAXW - 50, b.lh, false, b.maxLines);
      y += Math.min(per, lines * b.lh + 50);
    });
  } else {
    const b = fitBlock(ctx, text, 500, Math.round(50 * k), 26, avail);
    const lines = Math.min(b.maxLines, wrapWords(ctx, b.text, MAXW).length);
    const y0 = areaTop + Math.max(0, (avail - lines * b.lh) / 2 - 20);
    ctx.fillStyle = INK;
    ctx.font = `500 ${b.px}px Outfit`;
    drawParagraph(ctx, b.text, PAD, y0 + b.px, MAXW, b.lh, false, b.maxLines);
  }
  endTrack(tb);
  ctx.restore();
  drawPageBlocks(ctx, d, VH - 190);
  if (n < total) swipeHint(ctx);
  else { // last page: the signature instead of "Faites défiler"
    endShift(ctx);
    if (!isHidden(d, `${CUR_KIND}.signature`)) deco(ctx, d, "signature", VW / 2, VH - 78, () => drawSignature(ctx));
  }
}

// ---------- plan ----------
export function planCarousel(post) {
  const v = post.visual || {};
  const ed = post.editorial || {};
  const title = clean(v.title_short) || clean(ed.fact) || clean(post.meta?.topic);
  const content = resolveContent(post, title);
  const points = content.points.filter((p) => !TAKEAWAY_RE.test(p.label));
  const takeaway = clean(content.points.find((p) => TAKEAWAY_RE.test(p.label))?.text) ||
    clean(ed.insight) || clean(v.insight_line);
  const hasData = hasChart(post) || clean(v.important_date) || (v.data_points || []).filter((x) => clean(x)).length >= 2;
  const d = { post, v, title, content, takeaway, factsFree: !hasData };

  const tag = (kind, fn) => Object.assign(fn, { kind });
  const pages = [tag("cover", (ctx, im, n, t) => coverPage(ctx, d, im, n, t))];
  if (content.summary) pages.push(tag("essential", (ctx, im, n, t) => essentialPage(ctx, d, im, n, t)));
  if (hasData) pages.push(tag("data", (ctx, im, n, t) => dataPage(ctx, d, im, n, t)));
  if (points.length) {
    // one point per page when there are few pages, otherwise grouped
    if (points.length <= 2 || pages.length >= 3) pages.push(tag("points", (ctx, im, n, t) => pointsPage(ctx, d, im, n, t, points.slice(0, 3), L.analysis)));
    else points.slice(0, 3).forEach((p) => pages.push(tag("points", (ctx, im, n, t) => pointsPage(ctx, d, im, n, t, [p], p.label))));
  }
  if (takeaway) pages.push(tag("takeaway", (ctx, im, n, t) => takeawayPage(ctx, d, im, n, t)));

  // pages added by the user, each placed after the page they chose (default: before "À retenir")
  (Array.isArray(v.extra_pages) ? v.extra_pages : []).slice(0, 6).forEach((x) => {
    if (!x || !x.id) return;
    const page = tag(`extra-${x.id}`, (ctx, im, n, t) => extraPage(ctx, d, im, n, t, x));
    let at = -1;
    if (x.after === "end") at = pages.length;
    else if (x.after && x.after !== "auto") {
      const idx = pages.map((p) => p.kind).lastIndexOf(x.after);
      if (idx >= 0) at = idx + 1;
    }
    if (at < 0) {
      const t = pages.findIndex((p) => p.kind === "takeaway");
      at = t >= 0 ? t : pages.length;
    }
    pages.splice(at, 0, page);
  });
  // order chosen by the user (◀ ▶ in the editor); pages not listed keep their place at the end
  const order = Array.isArray(v.page_order) ? v.page_order : null;
  if (order && order.length) {
    const rank = (kind) => { const i = order.indexOf(kind); return i < 0 ? 999 : i; };
    pages.sort((a, b) => rank(a.kind) - rank(b.kind)); // stable: several "Décryptage" pages stay in order
  }
  const out = pages.slice(0, 12);
  out.data = d; // shared page data (used for the per-page source line)
  return out;
}

const PAGE_LABELS = { cover: "Couverture", essential: "L'essentiel", data: "Les chiffres", points: "Décryptage", takeaway: "À retenir" };
export const carouselPageKinds = (post) => planCarousel(post).map((f) => f.kind);
export const carouselPageLabel = (kind) => PAGE_LABELS[kind] || (String(kind || "").startsWith("extra-") ? "Page ajoutée" : "");

/** Renders each carousel page on its own canvas (created with `makeCanvas`). */
export function renderCarousel(post, images, makeCanvas, template) {
  // template: the full template (with byFormat); each page uses the carousel's settings, and the cover
  // or the inner pages their own ones on top
  const full = template !== undefined ? template : currentTemplate();
  const lang = langOf(post);
  // page headings and fixed sentences typed by the user for this post replace the default ones
  const ovr = post.visual?.carousel_labels;
  L = { ...CL[lang] };
  if (ovr && typeof ovr === "object") {
    Object.entries(ovr).forEach(([k, val]) => { if (k in L && typeof val === "string" && val.trim()) L[k] = val.trim(); });
  }
  setRenderLabels(post.visual?.labels);
  setRenderLang(lang);
  const plan = planCarousel(post);
  const d0 = plan.data;
  return plan.map((draw, i) => {
    const c = makeCanvas(VW, VH);
    applyTemplate(resolveTemplate(full, carouselScopes(i)));
    CUR_KIND = draw.kind;
    CUR_D = d0;
    SHIFTED = false;
    const cx = c.getContext("2d");
    try { instrument(cx); } catch { /* read-only context: no click selection */ }
    BOXES = [];
    TRACKERS = [];
    draw(cx, images, i + 1, plan.length);
    endShift(cx);
    try { c.elBoxes = BOXES; } catch { /* ignore */ }
    footSource(cx, d0, draw.kind);
    try { c.pageKind = draw.kind; } catch { /* read-only canvas object */ }
    return c;
  });
}
