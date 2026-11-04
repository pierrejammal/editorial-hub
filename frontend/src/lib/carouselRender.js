// LinkedIn carousel: the same post told in 4-6 swipeable pages, same FORSIDES style as the visual.
import {
  VW, VH, drawHeader, drawSignature, resolveContent, hasChart,
  drawParagraph, drawLabel, drawRule, drawBarChart, drawPieChart, wrapWords, fitSentences, fitFontSize,
  clean, PAD, BLUSH, BRICK, BORDEAUX, CORAL, INK, DOT, langOf, setRenderLang,
  applyTemplate, currentTemplate, tplScale, setRenderLabels, ellipsize, resolveTemplate, carouselScopes, drawBanner, titleFontFamily, drawBullet,
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

const blocksOf = (d) => {
  const all = (d.v.page_blocks || {})[CUR_KIND];
  return Array.isArray(all) ? all.filter((b) => b && (clean(b.text) || clean(b.value))).slice(0, 4) : [];
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
function blocksReserve(ctx, d) {
  const blocks = blocksOf(d);
  if (!blocks.length) return 0;
  const k = pageScale(d, CUR_KIND);
  return 40 + blocks.reduce((h, b) => h + drawBlock(ctx, b, 0, k, false) + BLOCK_GAP, 0);
}
function drawPageBlocks(ctx, d, bottom) {
  const blocks = blocksOf(d);
  if (!blocks.length) return;
  const k = pageScale(d, CUR_KIND);
  let y = bottom - blocksReserve(ctx, d) + 20;
  ctx.fillStyle = DOT;
  ctx.fillRect(PAD, y, MAXW, 2);
  y += 30;
  blocks.forEach((b) => { y += drawBlock(ctx, b, y, k, true) + BLOCK_GAP; });
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
  drawBanner(ctx, label, PAD, 60, bh, Math.round(56 * bs)); // same shape as the template's banner
  const logo = images?.logoImg;
  let lh = 0;
  if (logo) {
    lh = 60 * tplScale("logoScale");
    let lw = (logo.width / logo.height) * lh;
    if (lw > 520) { lw = 520; lh = lw * (logo.height / logo.width); }
    ctx.drawImage(logo, VW - PAD - lw, 64, lw, lh);
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
  ctx.fillText(`${n} / ${total}`, VW - PAD, VH - 70);
  ctx.textAlign = "left";
}

function swipeHint(ctx, label = L.swipe) {
  endShift(ctx);
  ctx.fillStyle = BRICK;
  ctx.font = "700 30px Outfit";
  ctx.textAlign = "left";
  ctx.fillText(ellipsize(ctx, `${label}  →`, MAXW - 160), PAD, VH - 70);
}

// Page title: wraps (and honours typed line breaks) and shrinks so it never leaves the page.
// Returns the extra height it takes beyond one line, so the page content moves down accordingly.
function bigLabel(ctx, text, y) {
  const fam = titleFontFamily();
  const w = MAXW - 34;
  let px = 44;
  ctx.font = `800 ${px}px ${fam}`;
  while (px > 28 && wrapWords(ctx, text, w).length > 2) { px -= 2; ctx.font = `800 ${px}px ${fam}`; }
  const lh = Math.round(px * 1.18);
  const lines = Math.min(5, wrapWords(ctx, text, w).length);
  ctx.fillStyle = BRICK;
  ctx.fillRect(PAD, y - 34, 14, 40);
  ctx.fillStyle = BORDEAUX;
  drawParagraph(ctx, text, PAD + 34, y, w, lh, false, 5);
  return Math.max(0, (lines - 1) * lh);
}

// ---------- pages ----------
function coverPage(ctx, d, images, n, total) {
  const top = drawHeader(ctx, d.post, images);
  beginShift(ctx, d);
  const area = { top: Math.max(top + 140, 360), bottom: VH - 360 };
  ctx.fillStyle = BORDEAUX;
  let px = Math.round(84 * pageScale(d, "cover"));
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
  const yEnd = drawParagraph(ctx, d.title, PAD, y0, MAXW, lh, false, maxLines);
  drawRule(ctx, yEnd + 10);
  if (d.content.source) {
    ctx.fillStyle = "#4a3a36";
    ctx.font = "500 30px Outfit";
    drawParagraph(ctx, `${d.content.multi ? L.sources : L.source} ${d.content.source}${d.content.date ? " · " + d.content.date.toLowerCase() : ""}`, PAD, yEnd + 74, MAXW, 40, false, 2);
  }
  swipeHint(ctx);
  pageCounter(ctx, n, total);
}

// Page 2: key figure + summary + a few facts, sized up and centred so the page is never half empty.
function essentialPage(ctx, d, images, n, total) {
  const k = pageScale(d, "essential");
  let top = miniHeader(ctx, images, n, total);
  beginShift(ctx, d);
  top += bigLabel(ctx, L.essential, top + 90);
  const areaTop = top + 150;
  const RB = VH - 170;
  const areaBottom = RB - blocksReserve(ctx, d);
  const fig = clean(d.v.key_figure_value);
  const figLabel = clean(d.v.key_figure_label);
  // short facts not already shown on the "chiffres" page
  const facts = d.factsFree ? (d.v.data_points || []).map(clean).filter(Boolean).slice(0, 3) : [];
  const src = d.content.source ? `${d.content.multi ? L.sources : L.source} ${d.content.source}${d.content.date ? " · " + d.content.date.toLowerCase() : ""}` : "";

  // measure everything at a given summary size, then pick the largest size that fits
  const layout = (sumPx) => {
    let h = 0;
    const parts = [];
    if (fig) {
      ctx.font = `${Math.round(190 * k)}px Anton`;
      const px = fitFontSize(ctx, fig, "Anton", Math.round(190 * k), MAXW, 80);
      parts.push({ k: "fig", px, h: px });
      h += px;
      if (figLabel) {
        ctx.font = "500 34px Outfit";
        const lines = Math.min(3, wrapWords(ctx, figLabel, MAXW).length);
        parts.push({ k: "figLabel", lines, h: 20 + lines * 46 });
        h += 20 + lines * 46;
      }
      h += 50;
    }
    if (d.content.summary) {
      ctx.font = `400 ${sumPx}px Outfit`;
      const lh = Math.round(sumPx * 1.38);
      const lines = wrapWords(ctx, d.content.summary, MAXW).length;
      parts.push({ k: "sum", px: sumPx, lh, lines, h: lines * lh });
      h += lines * lh;
    }
    if (facts.length) {
      ctx.font = "600 34px Outfit";
      const fh = facts.reduce((a, f) => a + Math.min(2, wrapWords(ctx, f, MAXW - 50).length) * 44 + 22, 0);
      parts.push({ k: "facts", h: 60 + fh });
      h += 60 + fh;
    }
    if (src) { parts.push({ k: "src", h: 90 }); h += 90; }
    return { h, parts };
  };
  let sumPx = Math.round(64 * k);
  let lay = layout(sumPx);
  while (sumPx > 30 && lay.h > areaBottom - areaTop) { sumPx -= 2; lay = layout(sumPx); }

  let y = areaTop + Math.max(0, (areaBottom - areaTop - lay.h) / 2); // centred block
  lay.parts.forEach((p) => {
    if (p.k === "fig") {
      ctx.fillStyle = BRICK;
      ctx.font = `${p.px}px Anton`;
      ctx.fillText(fig, PAD, y + p.px * 0.85);
      y += p.px;
    } else if (p.k === "figLabel") {
      ctx.fillStyle = INK;
      ctx.font = "500 34px Outfit";
      drawParagraph(ctx, figLabel, PAD, y + 20 + 34, MAXW, 46, false, 3);
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
        ctx.font = "600 34px Outfit";
        const end = drawParagraph(ctx, f, PAD + 50, y + 30, MAXW - 50, 44, false, 2);
        y = end - 44 + 22 + 14;
      });
    } else if (p.k === "src") {
      drawRule(ctx, y + 40);
      ctx.fillStyle = "#4a3a36";
      ctx.font = "500 28px Outfit";
      drawParagraph(ctx, src, PAD, y + 90, MAXW, 36, false, 2);
      y += p.h;
    }
  });
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
    top += bigLabel(ctx, L.figures, top + 90);
    const areaTop = top + 135;
    const areaBottom = VH - 170 - res;
    const ctitle = clean(chart.title).toUpperCase();
    const note = clean(chart.note);
    const facts = (d.v.data_points || []).map(clean).filter(Boolean).slice(0, 3);
    const vertical = chart.type !== "pie" && chart.items.every((i) => /^(\d{4}|[TSQH]\d[\s-]?\d{2,4}|\d{4}[\s-]\d{2,4})$/i.test(String(i.label).trim()));
    // few bars → taller rows so the chart fills the page instead of leaving a hole
    const rowMax = chart.items.length <= 3 ? 190 : 150;
    const natural = chart.type === "pie" || vertical ? 600 : Math.max(260, chart.items.length * rowMax);
    const avail = areaBottom - areaTop;

    const measure = (notePx, chartH, factPx) => {
      let h = 0;
      ctx.font = "600 22px Outfit";
      const tl = ctitle ? Math.min(2, wrapWords(ctx, ctitle, MAXW).length) : 0;
      h += tl ? tl * 32 + 26 : 0;
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
    let notePx = Math.round(34 * k);
    let factPx = Math.round(32 * k);
    let chartH = natural;
    let m = measure(notePx, chartH, factPx);
    while (m.h > avail && notePx > 22) { notePx -= 2; m = measure(notePx, chartH, factPx); }
    while (m.h > avail && chartH > 220) { chartH -= 20; m = measure(notePx, chartH, factPx); }
    // room left: enlarge the reading sentence and the facts a little
    while (notePx < 40 * k && measure(notePx + 2, chartH, factPx).h <= avail) { notePx += 2; m = measure(notePx, chartH, factPx); }
    while (factPx < 38 * k && measure(notePx, chartH, factPx + 2).h <= avail) { factPx += 2; m = measure(notePx, chartH, factPx); }
    // whatever is still free is spread between the sections (not above the chart), the rest stays at the bottom
    const free = Math.max(0, avail - m.h);
    const gaps = (m.nl ? 1 : 0) + (facts.length ? 1 : 0);
    const gapExtra = gaps ? Math.min(90, free / (gaps + 1)) : 0;

    let y = areaTop;
    if (m.tl) {
      ctx.fillStyle = "#8a6a62";
      ctx.font = "600 22px Outfit";
      const prev = ctx.letterSpacing;
      ctx.letterSpacing = "3px";
      wrapWords(ctx, ctitle, MAXW).slice(0, 2).forEach((ln, i) => ctx.fillText(ln.join(" "), PAD, y + 22 + i * 32));
      ctx.letterSpacing = prev || "0px";
      y += m.tl * 32 + 26;
    }
    if (chart.type === "pie") drawPieChart(ctx, chart, PAD, y, MAXW, chartH);
    else drawBarChart(ctx, chart, PAD, y, MAXW, chartH, { rowMax });
    y += chartH;
    if (m.nl) {
      y += gapExtra;
      ctx.fillStyle = "#4a3a36";
      ctx.font = `italic 500 ${notePx}px Outfit`;
      const lh = Math.round(notePx * 1.35);
      drawParagraph(ctx, note, PAD, y + 50 + notePx, MAXW, lh, false, m.nl);
      y += 50 + m.nl * lh;
    }
    if (facts.length) {
      y += 60 + gapExtra;
      facts.forEach((f, i) => {
        drawBullet(ctx, PAD, y + 6, 18, i % 2 === 0 ? BRICK : CORAL);
        ctx.fillStyle = BORDEAUX;
        ctx.font = `600 ${factPx}px Outfit`;
        const end = drawParagraph(ctx, f, PAD + 50, y + factPx - 4, MAXW - 50, m.flh, false, 2);
        y = end - m.flh + 20 + 14;
      });
    }
  } else {
    top += bigLabel(ctx, L.keyFigures, top + 90);
    let y = top + 190;
    const items = (d.v.data_points || []).map(clean).filter(Boolean).slice(0, 4);
    const date = clean(d.v.important_date);
    if (date) {
      ctx.fillStyle = CORAL;
      const px = fitFontSize(ctx, date, "Anton", 130, MAXW, 60);
      ctx.fillText(date, PAD, y + px * 0.85);
      ctx.fillStyle = INK;
      ctx.font = "500 32px Outfit";
      ctx.fillText(L.deadline, PAD, y + px + 30);
      y += px + 110;
    }
    const avail = VH - 220 - res - y;
    const per = items.length ? avail / items.length : 0;
    items.forEach((t, i) => {
      ctx.fillStyle = i % 2 === 0 ? BRICK : CORAL;
      drawBullet(ctx, PAD, y + 8, 18, ctx.fillStyle);
      const b = fitBlock(ctx, t, 600, Math.round(44 * k), 26, per - 30, 1.3, MAXW - 50);
      ctx.fillStyle = INK;
      drawParagraph(ctx, b.text, PAD + 50, y + b.px * 0.8, MAXW - 50, b.lh, false, b.maxLines);
      y += per;
    });
  }
  drawPageBlocks(ctx, d, VH - 170);
  swipeHint(ctx);
}

function pointsPage(ctx, d, images, n, total, points, heading) {
  const k = pageScale(d, "points");
  let top = miniHeader(ctx, images, n, total);
  beginShift(ctx, d);
  top += bigLabel(ctx, heading, top + 90);
  let y = top + 180;
  const res = blocksReserve(ctx, d);
  const per = (VH - 220 - res - y) / points.length;
  points.forEach((p, i) => {
    drawLabel(ctx, p.label.toUpperCase(), PAD, y);
    let fy = 0;
    if (p.value) { // "chiffre clé" section
      ctx.fillStyle = BRICK;
      const px = fitFontSize(ctx, p.value, "Anton", Math.round(120 * k), MAXW, 60);
      ctx.fillText(p.value, PAD, y + 30 + px * 0.9);
      fy = px + 20;
    }
    ctx.fillStyle = i % 2 === 0 ? BORDEAUX : INK;
    const b = fitBlock(ctx, p.text, 600, Math.round(54 * k), 26, per - 90 - fy);
    if (p.text) drawParagraph(ctx, b.text, PAD, y + 30 + fy + b.px, MAXW, b.lh, false, b.maxLines);
    if (i < points.length - 1) {
      ctx.fillStyle = DOT;
      ctx.fillRect(PAD, y + per - 40, MAXW, 2);
    }
    y += per;
  });
  drawPageBlocks(ctx, d, VH - 180);
  swipeHint(ctx);
}

function takeawayPage(ctx, d, images, n, total) {
  let top = miniHeader(ctx, images, n, total);
  beginShift(ctx, d);
  top += bigLabel(ctx, L.takeaway, top + 90);
  // quotes are drawn by the page itself (opening and closing), so strip any typed in the text
  const text = String(d.takeaway || "").replace(/^[\s«»“”"']+|[\s«»“”"']+$/g, "");
  const area = { top: top + 175, bottom: VH - 440 - blocksReserve(ctx, d) };
  const QH = 120; // room taken by each quote mark
  const b = fitBlock(ctx, text, 700, Math.round(64 * pageScale(d, "takeaway")), 30, area.bottom - area.top - QH * 2, 1.25);
  const lines = Math.min(b.maxLines, wrapWords(ctx, b.text, MAXW).length);
  const blockH = QH + lines * b.lh + QH;
  // the quote + text block is centred in the free space, so there is no hole under the opening quote
  const y0 = area.top + Math.max(0, (area.bottom - area.top - blockH) / 2);
  ctx.fillStyle = BRICK;
  ctx.font = "220px Anton";
  ctx.fillText("“", PAD - 10, y0 + 175);
  ctx.fillStyle = BORDEAUX;
  ctx.font = `700 ${b.px}px Outfit`;
  drawParagraph(ctx, b.text, PAD, y0 + QH + b.px, MAXW, b.lh, false, b.maxLines);
  ctx.fillStyle = BRICK;
  ctx.font = "220px Anton";
  ctx.textAlign = "right";
  ctx.fillText("”", VW - PAD + 10, y0 + QH + lines * b.lh + 175);
  ctx.textAlign = "left";
  drawPageBlocks(ctx, d, VH - 420);
  endShift(ctx); // the closing question stays in place
  drawRule(ctx, VH - 400);
  // closing texts wrap (2 lines max each) instead of running off the page
  ctx.fillStyle = INK;
  ctx.font = "600 34px Outfit";
  const qEnd = drawParagraph(ctx, clean(d.v.cta_question) || L.ctaQ, PAD, VH - 320, MAXW, 42, false, 2);
  ctx.fillStyle = "#4a3a36";
  ctx.font = "400 30px Outfit";
  drawParagraph(ctx, clean(d.v.cta_text) || L.cta, PAD, Math.max(VH - 270, qEnd + 8), MAXW, 38, false, 2);
  drawSignature(ctx);
}

// Page added by the user ("Ajouter une page"): texte, chiffre clé, citation or liste
function extraPage(ctx, d, images, n, total, x) {
  const k = pageScale(d, `extra-${x.id}`);
  let top = miniHeader(ctx, images, n, total);
  beginShift(ctx, d);
  const title = clean(x.title);
  if (title) top += bigLabel(ctx, title, top + 90);
  const areaTop = top + (title ? 170 : 90);
  const areaBottom = VH - 200 - blocksReserve(ctx, d);
  const avail = areaBottom - areaTop;
  const text = clean(x.text);
  const type = x.type || "text";

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
  drawPageBlocks(ctx, d, VH - 190);
  swipeHint(ctx);
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
  return pages.slice(0, 12);
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
  return plan.map((draw, i) => {
    const c = makeCanvas(VW, VH);
    applyTemplate(resolveTemplate(full, carouselScopes(i)));
    CUR_KIND = draw.kind;
    SHIFTED = false;
    const cx = c.getContext("2d");
    draw(cx, images, i + 1, plan.length);
    endShift(cx);
    try { c.pageKind = draw.kind; } catch { /* read-only canvas object */ }
    return c;
  });
}
