// LinkedIn carousel: the same post told in 4-6 swipeable pages, same FORSIDES style as the visual.
import {
  VW, VH, drawHeader, drawSignature, resolveContent, hasChart,
  drawParagraph, drawLabel, drawRule, drawBarChart, drawPieChart, wrapWords, fitSentences, fitFontSize,
  clean, PAD, BLUSH, BRICK, BORDEAUX, CORAL, INK, DOT, langOf, setRenderLang,
  applyTemplate, currentTemplate, titleFontFamily, drawBullet,
} from "@/lib/visualRender";

const CL = {
  fr: {
    swipe: "Faites défiler", source: "Source :", essential: "L'essentiel", figures: "Les chiffres",
    keyFigures: "Les chiffres clés", deadline: "échéance à retenir", analysis: "Décryptage", takeaway: "À retenir",
    ctaQ: "Vous avez trouvé ce décryptage utile ?", cta: "Suivez FORSIDES pour ne rien manquer de l'actualité actuarielle.",
  },
  en: {
    swipe: "Swipe", source: "Source:", essential: "In a nutshell", figures: "The figures",
    keyFigures: "Key figures", deadline: "key deadline", analysis: "Analysis", takeaway: "Key takeaway",
    ctaQ: "Found this analysis useful?", cta: "Follow FORSIDES for the latest actuarial and insurance news.",
  },
};
let L = CL.fr;
const TAKEAWAY_RE = /retenir|takeaway/i;

const MAXW = VW - PAD * 2;

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
  ctx.font = "56px Anton";
  const tw = ctx.measureText(label).width;
  if (label) {
    ctx.fillStyle = BRICK;
    ctx.fillRect(PAD, 60, tw + 28, 70);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, PAD + 14, 117);
  }
  const logo = images?.logoImg;
  if (logo) {
    const lh = 60;
    const lw = (logo.width / logo.height) * lh;
    ctx.drawImage(logo, VW - PAD - lw, 64, lw, lh);
  }
  pageCounter(ctx, n, total);
  return 200;
}

function pageCounter(ctx, n, total) {
  ctx.textAlign = "right";
  ctx.fillStyle = "#8a6a62";
  ctx.font = "600 26px Outfit";
  ctx.fillText(`${n} / ${total}`, VW - PAD, VH - 70);
  ctx.textAlign = "left";
}

function swipeHint(ctx, label = L.swipe) {
  ctx.fillStyle = BRICK;
  ctx.font = "700 30px Outfit";
  ctx.textAlign = "left";
  ctx.fillText(`${label}  →`, PAD, VH - 70);
}

function bigLabel(ctx, text, y) {
  ctx.fillStyle = BRICK;
  ctx.fillRect(PAD, y - 34, 14, 40);
  ctx.fillStyle = BORDEAUX;
  ctx.font = "800 44px Outfit";
  ctx.fillText(text, PAD + 34, y);
}

// ---------- pages ----------
function coverPage(ctx, d, images, n, total) {
  const top = drawHeader(ctx, d.post, images);
  const area = { top: Math.max(top + 140, 360), bottom: VH - 360 };
  ctx.fillStyle = BORDEAUX;
  let px = 84;
  const fam = titleFontFamily();
  ctx.font = `800 ${px}px ${fam}`;
  while (px > 46 && wrapWords(ctx, d.title, MAXW).length * px * 1.18 > area.bottom - area.top) {
    px -= 2;
    ctx.font = `800 ${px}px ${fam}`;
  }
  const lh = Math.round(px * 1.18);
  const lines = wrapWords(ctx, d.title, MAXW).length;
  const y0 = area.top + ((area.bottom - area.top) - lines * lh) / 2 + px;
  const yEnd = drawParagraph(ctx, d.title, PAD, y0, MAXW, lh, false, 8);
  drawRule(ctx, yEnd + 10);
  if (d.content.source) {
    ctx.fillStyle = "#4a3a36";
    ctx.font = "500 30px Outfit";
    ctx.fillText(`${L.source} ${d.content.source}${d.content.date ? " · " + d.content.date.toLowerCase() : ""}`, PAD, yEnd + 74);
  }
  swipeHint(ctx);
  pageCounter(ctx, n, total);
}

// Page 2: key figure + summary + a few facts, sized up and centred so the page is never half empty.
function essentialPage(ctx, d, images, n, total) {
  const top = miniHeader(ctx, images, n, total);
  bigLabel(ctx, L.essential, top + 90);
  const areaTop = top + 150;
  const areaBottom = VH - 170;
  const fig = clean(d.v.key_figure_value);
  const figLabel = clean(d.v.key_figure_label);
  // short facts not already shown on the "chiffres" page
  const facts = d.factsFree ? (d.v.data_points || []).map(clean).filter(Boolean).slice(0, 3) : [];
  const src = d.content.source ? `${L.source} ${d.content.source}${d.content.date ? " · " + d.content.date.toLowerCase() : ""}` : "";

  // measure everything at a given summary size, then pick the largest size that fits
  const layout = (sumPx) => {
    let h = 0;
    const parts = [];
    if (fig) {
      ctx.font = "190px Anton";
      const px = fitFontSize(ctx, fig, "Anton", 190, MAXW, 80);
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
  let sumPx = 64;
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
      ctx.fillText(src, PAD, y + 90);
      y += p.h;
    }
  });
  swipeHint(ctx);
}

function dataPage(ctx, d, images, n, total) {
  const top = miniHeader(ctx, images, n, total);
  const chart = d.v.chart;
  if (hasChart(d.post)) {
    // chart sized to what it needs, its reading sentence in full, then the key facts;
    // the whole block is centred so the page is never half empty
    bigLabel(ctx, L.figures, top + 90);
    const areaTop = top + 135;
    const areaBottom = VH - 170;
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
    let notePx = 34;
    let factPx = 32;
    let chartH = natural;
    let m = measure(notePx, chartH, factPx);
    while (m.h > avail && notePx > 22) { notePx -= 2; m = measure(notePx, chartH, factPx); }
    while (m.h > avail && chartH > 220) { chartH -= 20; m = measure(notePx, chartH, factPx); }
    // room left: enlarge the reading sentence and the facts a little
    while (notePx < 40 && measure(notePx + 2, chartH, factPx).h <= avail) { notePx += 2; m = measure(notePx, chartH, factPx); }
    while (factPx < 38 && measure(notePx, chartH, factPx + 2).h <= avail) { factPx += 2; m = measure(notePx, chartH, factPx); }
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
    bigLabel(ctx, L.keyFigures, top + 90);
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
    const avail = VH - 220 - y;
    const per = items.length ? avail / items.length : 0;
    items.forEach((t, i) => {
      ctx.fillStyle = i % 2 === 0 ? BRICK : CORAL;
      drawBullet(ctx, PAD, y + 8, 18, ctx.fillStyle);
      const b = fitBlock(ctx, t, 600, 44, 28, per - 30, 1.3, MAXW - 50);
      ctx.fillStyle = INK;
      drawParagraph(ctx, b.text, PAD + 50, y + b.px * 0.8, MAXW - 50, b.lh, false, b.maxLines);
      y += per;
    });
  }
  swipeHint(ctx);
}

function pointsPage(ctx, d, images, n, total, points, heading) {
  const top = miniHeader(ctx, images, n, total);
  bigLabel(ctx, heading, top + 90);
  let y = top + 180;
  const per = (VH - 220 - y) / points.length;
  points.forEach((p, i) => {
    drawLabel(ctx, p.label.toUpperCase(), PAD, y);
    ctx.fillStyle = i % 2 === 0 ? BORDEAUX : INK;
    const b = fitBlock(ctx, p.text, 600, 54, 28, per - 90);
    drawParagraph(ctx, b.text, PAD, y + 30 + b.px, MAXW, b.lh, false, b.maxLines);
    if (i < points.length - 1) {
      ctx.fillStyle = DOT;
      ctx.fillRect(PAD, y + per - 40, MAXW, 2);
    }
    y += per;
  });
  swipeHint(ctx);
}

function takeawayPage(ctx, d, images, n, total) {
  const top = miniHeader(ctx, images, n, total);
  bigLabel(ctx, L.takeaway, top + 90);
  // quotes are drawn by the page itself (opening and closing), so strip any typed in the text
  const text = String(d.takeaway || "").replace(/^[\s«»“”"']+|[\s«»“”"']+$/g, "");
  const area = { top: top + 175, bottom: VH - 440 };
  const QH = 120; // room taken by each quote mark
  const b = fitBlock(ctx, text, 700, 64, 34, area.bottom - area.top - QH * 2, 1.25);
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
  drawRule(ctx, VH - 400);
  ctx.fillStyle = INK;
  ctx.font = "600 34px Outfit";
  ctx.fillText(L.ctaQ, PAD, VH - 320);
  ctx.fillStyle = "#4a3a36";
  ctx.font = "400 30px Outfit";
  ctx.fillText(L.cta, PAD, VH - 270);
  drawSignature(ctx);
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
  return pages.slice(0, 6);
}

const PAGE_LABELS = { cover: "Couverture", essential: "L'essentiel", data: "Les chiffres", points: "Décryptage", takeaway: "À retenir" };
export const carouselPageKinds = (post) => planCarousel(post).map((f) => f.kind);
export const carouselPageLabel = (kind) => PAGE_LABELS[kind] || "";

/** Renders each carousel page on its own canvas (created with `makeCanvas`). */
export function renderCarousel(post, images, makeCanvas, template) {
  if (template !== undefined) applyTemplate(template);
  const lang = langOf(post);
  L = CL[lang];
  setRenderLang(lang);
  const plan = planCarousel(post);
  return plan.map((draw, i) => {
    const c = makeCanvas(VW, VH);
    draw(c.getContext("2d"), images, i + 1, plan.length);
    try { c.pageKind = draw.kind; } catch { /* read-only canvas object */ }
    return c;
  });
}
