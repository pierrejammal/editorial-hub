// LinkedIn carousel: the same post told in 4-6 swipeable pages, same FORSIDES style as the visual.
import {
  VW, VH, drawHeader, drawSignature, resolveContent, hasChart,
  drawParagraph, drawLabel, drawRule, drawBarChart, drawPieChart, wrapWords, fitSentences, fitFontSize,
  clean, PAD, BLUSH, BRICK, BORDEAUX, CORAL, INK, DOT,
} from "@/lib/visualRender";

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
  ctx.font = "56px Anton";
  const tw = ctx.measureText("NEWS").width;
  ctx.fillStyle = BRICK;
  ctx.fillRect(PAD, 60, tw + 28, 70);
  ctx.fillStyle = "#fff";
  ctx.fillText("NEWS", PAD + 14, 117);
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

function swipeHint(ctx, label = "Faites défiler") {
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
  ctx.font = `800 ${px}px Outfit`;
  while (px > 46 && wrapWords(ctx, d.title, MAXW).length * px * 1.18 > area.bottom - area.top) {
    px -= 2;
    ctx.font = `800 ${px}px Outfit`;
  }
  const lh = Math.round(px * 1.18);
  const lines = wrapWords(ctx, d.title, MAXW).length;
  const y0 = area.top + ((area.bottom - area.top) - lines * lh) / 2 + px;
  const yEnd = drawParagraph(ctx, d.title, PAD, y0, MAXW, lh, false, 8);
  drawRule(ctx, yEnd + 10);
  if (d.content.source) {
    ctx.fillStyle = "#4a3a36";
    ctx.font = "500 30px Outfit";
    ctx.fillText(`Source : ${d.content.source}${d.content.date ? " · " + d.content.date.toLowerCase() : ""}`, PAD, yEnd + 74);
  }
  swipeHint(ctx);
  pageCounter(ctx, n, total);
}

function essentialPage(ctx, d, images, n, total) {
  const top = miniHeader(ctx, images, n, total);
  bigLabel(ctx, "L'essentiel", top + 90);
  let y = top + 170;
  const fig = clean(d.v.key_figure_value);
  if (fig) {
    ctx.fillStyle = BRICK;
    const px = fitFontSize(ctx, fig, "Anton", 190, MAXW, 80);
    ctx.fillText(fig, PAD, y + px * 0.85);
    y += px + 10;
    if (clean(d.v.key_figure_label)) {
      ctx.fillStyle = INK;
      ctx.font = "500 34px Outfit";
      y = drawParagraph(ctx, d.v.key_figure_label, PAD, y + 20, MAXW, 46, false, 3) + 50;
    }
  }
  const b = fitBlock(ctx, d.content.summary, 400, 52, 30, VH - 200 - y);
  ctx.fillStyle = INK;
  drawParagraph(ctx, b.text, PAD, y + b.px, MAXW, b.lh, false, b.maxLines);
  swipeHint(ctx);
}

function dataPage(ctx, d, images, n, total) {
  const top = miniHeader(ctx, images, n, total);
  const chart = d.v.chart;
  if (hasChart(d.post)) {
    bigLabel(ctx, "Les chiffres", top + 90);
    let y = top + 150;
    if (clean(chart.title)) {
      drawLabel(ctx, chart.title.toUpperCase(), PAD, y);
      y += 40;
    }
    const note = clean(chart.note);
    const noteH = note ? 150 : 0;
    const h = Math.min(820, VH - 220 - y - noteH);
    if (chart.type === "pie") drawPieChart(ctx, chart, PAD, y, MAXW, h);
    else drawBarChart(ctx, chart, PAD, y, MAXW, h);
    if (note) {
      ctx.fillStyle = "#4a3a36";
      ctx.font = "italic 500 34px Outfit";
      const t = fitSentences(ctx, note, MAXW, 3);
      drawParagraph(ctx, t, PAD, y + h + 70, MAXW, 46, false, 3);
    }
  } else {
    bigLabel(ctx, "Les chiffres clés", top + 90);
    let y = top + 190;
    const items = (d.v.data_points || []).map(clean).filter(Boolean).slice(0, 4);
    const date = clean(d.v.important_date);
    if (date) {
      ctx.fillStyle = CORAL;
      const px = fitFontSize(ctx, date, "Anton", 130, MAXW, 60);
      ctx.fillText(date, PAD, y + px * 0.85);
      ctx.fillStyle = INK;
      ctx.font = "500 32px Outfit";
      ctx.fillText("échéance à retenir", PAD, y + px + 30);
      y += px + 110;
    }
    const avail = VH - 220 - y;
    const per = items.length ? avail / items.length : 0;
    items.forEach((t, i) => {
      ctx.fillStyle = i % 2 === 0 ? BRICK : CORAL;
      ctx.fillRect(PAD, y + 8, 18, 18);
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
  bigLabel(ctx, "À retenir", top + 90);
  const text = d.takeaway;
  const area = { top: top + 160, bottom: VH - 470 };
  ctx.fillStyle = BRICK;
  ctx.font = "220px Anton";
  ctx.fillText("“", PAD - 10, area.top + 170);
  const b = fitBlock(ctx, text, 700, 64, 36, area.bottom - area.top - 140, 1.25);
  ctx.fillStyle = BORDEAUX;
  drawParagraph(ctx, b.text, PAD, area.top + 160 + b.px, MAXW, b.lh, false, b.maxLines);
  drawRule(ctx, VH - 400);
  ctx.fillStyle = INK;
  ctx.font = "600 34px Outfit";
  ctx.fillText("Vous avez trouvé ce décryptage utile ?", PAD, VH - 320);
  ctx.fillStyle = "#4a3a36";
  ctx.font = "400 30px Outfit";
  ctx.fillText("Suivez FORSIDES pour ne rien manquer de l'actualité actuarielle.", PAD, VH - 270);
  drawSignature(ctx);
}

// ---------- plan ----------
export function planCarousel(post) {
  const v = post.visual || {};
  const ed = post.editorial || {};
  const title = clean(v.title_short) || clean(ed.fact) || clean(post.meta?.topic);
  const content = resolveContent(post, title);
  const points = content.points.filter((p) => !/retenir/i.test(p.label));
  const takeaway = clean(content.points.find((p) => /retenir/i.test(p.label))?.text) ||
    clean(ed.insight) || clean(v.insight_line);
  const hasData = hasChart(post) || clean(v.important_date) || (v.data_points || []).filter((x) => clean(x)).length >= 2;
  const d = { post, v, title, content, takeaway };

  const pages = [(ctx, im, n, t) => coverPage(ctx, d, im, n, t)];
  if (content.summary) pages.push((ctx, im, n, t) => essentialPage(ctx, d, im, n, t));
  if (hasData) pages.push((ctx, im, n, t) => dataPage(ctx, d, im, n, t));
  if (points.length) {
    // one point per page when there are few pages, otherwise grouped
    if (points.length <= 2 || pages.length >= 3) pages.push((ctx, im, n, t) => pointsPage(ctx, d, im, n, t, points.slice(0, 3), "Décryptage"));
    else points.slice(0, 3).forEach((p) => pages.push((ctx, im, n, t) => pointsPage(ctx, d, im, n, t, [p], p.label)));
  }
  if (takeaway) pages.push((ctx, im, n, t) => takeawayPage(ctx, d, im, n, t));
  return pages.slice(0, 6);
}

/** Renders each carousel page on its own canvas (created with `makeCanvas`). */
export function renderCarousel(post, images, makeCanvas) {
  const plan = planCarousel(post);
  return plan.map((draw, i) => {
    const c = makeCanvas(VW, VH);
    draw(c.getContext("2d"), images, i + 1, plan.length);
    return c;
  });
}
