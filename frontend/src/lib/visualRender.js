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

function drawParagraph(ctx, text, x, y, maxW, lineH, justify, maxLines = 99, draw = true) {
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
    if (justify && !isLast && ln.length > 1) {
      const wordsW = ln.reduce((s, w) => s + ctx.measureText(w).width, 0);
      const gap = (maxW - wordsW) / (ln.length - 1);
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

function drawEmblem(ctx, id, rightX, topY) {
  // right-aligned emblem: acronym chip + name line
  ctx.textAlign = "right";
  if (id.acronym) {
    ctx.font = "700 20px Outfit";
    const nameW = Math.min(ctx.measureText(id.name).width, 330);
    ctx.fillStyle = "#555";
    // name (wrapped to max 2 lines) under acronym
    ctx.font = "800 34px Outfit";
    ctx.fillStyle = BORDEAUX;
    ctx.fillText(id.acronym, rightX, topY + 30);
    ctx.font = "500 17px Outfit";
    ctx.fillStyle = "#666";
    ctx.textAlign = "left";
    drawParagraph(ctx, id.name, rightX - nameW, topY + 54, nameW, 22, false, 2);
  } else {
    ctx.font = "600 22px Outfit";
    ctx.fillStyle = "#333";
    ctx.fillText(id.name, rightX, topY + 30);
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
  const v = post.visual || {};
  const ed = post.editorial || {};
  const m = post.meta || {};
  const t = clean(title);
  const pick = (...cands) => cands.map(clean).find((c) => c && c !== t) || "";

  const summary = pick(v.subtitle, ed.fact, m.summary, post.summary, firstSentences(post.caption, 2));

  let points = [
    { label: "Ce qui change", text: clean(ed.what_changes) },
    { label: "Pourquoi c'est important", text: clean(ed.why_important) },
    { label: "À retenir", text: clean(ed.insight) || clean(v.insight_line) },
  ].filter((p) => p.text && p.text !== summary && p.text !== t);
  if (!points.length) {
    points = (v.data_points || []).map(clean).filter(Boolean).slice(0, 3)
      .map((text, i) => ({ label: ["Point clé", "À noter", "À retenir"][i], text }));
  }
  if (!points.length && clean(v.insight_line) && clean(v.insight_line) !== summary) {
    points = [{ label: "À retenir", text: clean(v.insight_line) }];
  }
  if (!points.length && summary && summary === firstSentences(post.caption, 2)) {
    const rest = clean(post.caption).replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter(Boolean).slice(2, 5);
    points = rest.filter((x) => x.length > 25).map((text, i) => ({ label: ["À noter", "Et aussi", "À retenir"][i], text }));
  }

  const source = clean(m.source);
  const srcTitle = pick(m.source_title, post.sources?.[0]?.title, m.topic);
  return { summary, points, source, sourceTitle: srcTitle !== source ? srcTitle : "", date: clean(m.date_label) };
}

// Density-aware scale: sparse content gets bigger type so the canvas never looks empty.
function fitScale(measure, avail) {
  let s = 1;
  for (let i = 0; i < 6; i++) {
    const used = measure(s);
    if (used >= avail * 0.78 || s >= 1.5) break;
    s = Math.min(1.5, s * Math.min(1.18, Math.sqrt((avail * 0.85) / Math.max(used, 1))));
  }
  return s;
}

function renderAnalysis(ctx, { title, content, headerBottom, footerTop }) {
  ctx.fillStyle = BORDEAUX;
  ctx.font = "800 58px Outfit";
  ctx.textAlign = "left";
  const titleTop = Math.max(headerBottom + 110, 310);
  const titleBottom = drawParagraph(ctx, title, PAD, titleTop, VW - PAD * 2, 70, true, 4);
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
  const gap = blocks > 1 ? Math.min(120 * s, Math.max(36, (bottom - top - used) / (blocks - 1))) : 0;

  let y = top;
  if (content.summary) {
    drawLabel(ctx, "L'ESSENTIEL", PAD, y);
    ctx.fillStyle = INK;
    ctx.font = `400 ${Math.round(31 * s)}px Outfit`;
    y = drawParagraph(ctx, content.summary, PAD, y + 44 * s, maxW, 44 * s, true, 6) + gap;
  }
  points.forEach((p, i) => {
    if (y > bottom - 60) return;
    ctx.fillStyle = i % 2 === 0 ? BRICK : CORAL;
    ctx.fillRect(PAD, y - 6, 14, 14);
    drawLabel(ctx, p.label.toUpperCase(), PAD + 40, y);
    ctx.fillStyle = i % 2 === 0 ? BORDEAUX : INK;
    ctx.font = `500 ${Math.round(30 * s)}px Outfit`;
    y = drawParagraph(ctx, p.text, PAD + 40, y + 46 * s, maxW - 40, 40 * s, false, 4) + gap;
  });
}

function renderData(ctx, { v, title, content, headerBottom, footerTop }) {
  ctx.fillStyle = BORDEAUX;
  ctx.font = "800 46px Outfit";
  ctx.textAlign = "left";
  const titleTop = Math.max(headerBottom + 90, 300);
  const titleBottom = drawParagraph(ctx, title, PAD, titleTop, VW - PAD * 2, 56, true, 4);
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
    const leftCol = (s, draw) => {
      let y = top;
      if (fig) {
        if (draw) { ctx.fillStyle = BRICK; }
        ctx.font = `${Math.round(128 * s)}px Anton`;
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
        if (draw) { ctx.fillStyle = INK; ctx.font = `500 ${Math.round(26 * s)}px Outfit`; ctx.fillText("échéance à retenir", leftX, dy + 10 * s); }
        y = dy + 50 * s;
      }
      if (extras.length) {
        if (draw) drawLabel(ctx, "LES CHIFFRES", leftX, y + 40 * s);
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
    drawLabel(ctx, "L'ESSENTIEL", leftX, ly + 10);
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
      if (ry > bottom - 60) return;
      drawLabel(ctx, p.label.toUpperCase(), rx, ry + 10);
      ctx.fillStyle = i % 2 === 0 ? BORDEAUX : BRICK;
      ctx.font = `600 ${Math.round(34 * s)}px Outfit`;
      ry = drawParagraph(ctx, p.text, rx, ry + 56 * s, rightW, 44 * s, false, 4) + 42;
    });
  } else if (content.sourceTitle || content.source) {
    drawLabel(ctx, "À LA SOURCE", rx, top + 10);
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

function drawSourceFooter(ctx, content, top) {
  if (!content.source && !content.sourceTitle) return;
  ctx.fillStyle = DOT;
  ctx.fillRect(PAD, top, VW - PAD * 2, 2);
  ctx.textAlign = "left";
  drawLabel(ctx, "SOURCE", PAD, top + 36);
  const labelW = ctx.measureText("SOURCE").width + 40;
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

// opts: { post, version, images:{logoImg, sourceLogoImg} }
export function renderVisual(ctx, { post, version, images }) {
  const v = post.visual || {};
  const { logoImg, sourceLogoImg } = images || {};
  const title = v.title_short || post.editorial?.fact || post.meta?.topic || "";

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
    if (id) drawEmblem(ctx, id, VW - PAD, logoBottom + 18);
  }

  const headerBottom = bannerBottom + 40;
  const content = resolveContent(post, title);
  const footerTop = VH - 200;

  if (version === "B") renderData(ctx, { v, title, content, headerBottom, footerTop });
  else renderAnalysis(ctx, { title, content, headerBottom, footerTop });

  drawSourceFooter(ctx, content, footerTop);

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

export const FONT_SET = ["120px Anton", "800 60px Outfit", "500 28px Outfit", "700 44px Caveat", "140px Anton"];
