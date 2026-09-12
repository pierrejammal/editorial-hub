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
  { k: ["eiopa"], acronym: "EIOPA", name: "European Insurance & Occupational Pensions Authority" },
  { k: ["cour des comptes", "ccomptes"], acronym: "C•C", name: "Cour des comptes" },
  { k: ["drees"], acronym: "DREES", name: "Recherche, études, évaluation & statistiques" },
  { k: ["france assureurs", "france assureur"], acronym: "FA", name: "France Assureurs" },
  { k: ["insee"], acronym: "INSEE", name: "Institut national de la statistique" },
  { k: ["ocde", "oecd"], acronym: "OCDE", name: "Organisation de coopération et de développement" },
  { k: ["commission européenne", "ec.europa", "european commission"], acronym: "CE", name: "Commission européenne" },
  { k: ["ifrs"], acronym: "IFRS", name: "IFRS Foundation" },
  { k: ["sécurité sociale", "securite sociale"], acronym: "DSS", name: "Direction de la Sécurité sociale" },
  { k: ["parlement", "assemblée", "sénat", "ministère", "ministere", "gouvernement"], acronym: "RF", name: "République française" },
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

function drawParagraph(ctx, text, x, y, maxW, lineH, justify) {
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
    drawParagraph(ctx, id.name, rightX - nameW, topY + 54, nameW, 22, false);
    // realign for wrapped call (left anchored) -> redo right aligned simply:
  } else {
    ctx.font = "600 22px Outfit";
    ctx.fillStyle = "#333";
    ctx.fillText(id.name, rightX, topY + 30);
  }
  ctx.textAlign = "left";
}

// opts: { post, version, images:{logoImg, sourceLogoImg, mainImg} }
export function renderVisual(ctx, { post, version, images }) {
  const v = post.visual || {};
  const { logoImg, sourceLogoImg, mainImg } = images || {};
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
    const sh = 58;
    const sw = Math.min((sourceLogoImg.width / sourceLogoImg.height) * sh, 250);
    ctx.drawImage(sourceLogoImg, VW - PAD - sw, logoBottom + 20, sw, sh);
  } else if (post.meta?.source) {
    const id = sourceIdentity(post.meta.source);
    if (id) drawEmblem(ctx, id, VW - PAD, logoBottom + 18);
  }

  const headerBottom = bannerBottom + 40;

  if (version === "B") {
    ctx.fillStyle = BORDEAUX;
    ctx.font = "800 46px Outfit";
    ctx.textAlign = "left";
    const titleTop = Math.max(headerBottom + 90, 300);
    const titleBottom = drawParagraph(ctx, title, PAD, titleTop, VW - PAD * 2, 56, true);

    const colGap = 60;
    const leftX = PAD;
    const leftW = (VW - PAD * 2 - colGap) * 0.46;
    const rightX = leftX + leftW + colGap;
    const rightW = VW - PAD - rightX;
    let ly = titleBottom + 70;

    if (v.key_figure_value) {
      ctx.fillStyle = BRICK;
      ctx.font = "128px Anton";
      ctx.fillText(String(v.key_figure_value), leftX, ly + 100);
      ly += 118;
      if (v.key_figure_label) {
        ctx.fillStyle = INK;
        ctx.font = "500 27px Outfit";
        ly = drawParagraph(ctx, v.key_figure_label, leftX, ly + 20, leftW, 36, false) + 40;
      }
    }
    if (v.important_date) {
      ctx.fillStyle = CORAL;
      ctx.font = "84px Anton";
      const dy = drawParagraph(ctx, String(v.important_date), leftX, ly + 60, leftW, 78, false);
      ctx.fillStyle = INK;
      ctx.font = "500 26px Outfit";
      ctx.fillText("échéance à retenir", leftX, dy + 10);
    }

    const points = (v.data_points || []).slice(0, 2);
    let ry = titleBottom + 90;
    points.forEach((p, i) => {
      if (ry > VH - 470) return;
      ctx.fillStyle = i % 2 === 0 ? CORAL : BORDEAUX;
      ctx.font = "54px Anton";
      ctx.textAlign = "right";
      ry = drawParagraph(ctx, p, rightX + rightW, ry + 48, rightW, 56, false) + 44;
      ctx.textAlign = "left";
    });

    // decorations
    ctx.fillStyle = DOT;
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 6; c++) {
        ctx.beginPath();
        ctx.arc(PAD + c * 26, VH - 320 + r * 26, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    ctx.save();
    ctx.fillStyle = BRICK;
    ctx.beginPath();
    ctx.arc(VW - 118, VH - 258, 88, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = BLUSH;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(VW - 118, VH - 258);
    ctx.lineTo(VW - 22, VH - 258);
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.fillStyle = BORDEAUX;
    ctx.font = "800 58px Outfit";
    ctx.textAlign = "left";
    const titleTop = Math.max(headerBottom + 120, 320);
    const titleBottom = drawParagraph(ctx, title, PAD, titleTop, VW - PAD * 2, 70, true);

    const imgTop = titleBottom + 30;
    const imgBottom = VH - 168;
    const ih = imgBottom - imgTop;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, imgTop, VW, ih);
    ctx.clip();
    if (mainImg) {
      const ar = mainImg.width / mainImg.height;
      const tar = VW / ih;
      let dw, dh, dx, dy;
      if (ar > tar) {
        dh = ih;
        dw = ih * ar;
        dx = (VW - dw) / 2;
        dy = imgTop;
      } else {
        dw = VW;
        dh = VW / ar;
        dx = 0;
        dy = imgTop - (dh - ih) / 2;
      }
      ctx.drawImage(mainImg, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = "#ecd9d3";
      ctx.fillRect(0, imgTop, VW, ih);
      ctx.fillStyle = "#a9776c";
      ctx.font = "500 26px Outfit";
      ctx.textAlign = "center";
      ctx.fillText("Ajoutez ou générez une image →", VW / 2, imgTop + ih / 2);
      ctx.textAlign = "left";
    }
    ctx.restore();
  }

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
