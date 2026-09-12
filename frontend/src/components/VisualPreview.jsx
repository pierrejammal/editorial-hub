import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { genVisual } from "@/lib/api";
import { useStudio } from "@/context/StudioContext";
import { Download, ImagePlus, LayoutTemplate, Loader2, Type, Upload, FileDown } from "lucide-react";

const W = 1200;
const H = 1500;
const PAD = 66;
const BLUSH = "#F7E8E4";
const BRICK = "#C0453A";
const BORDEAUX = "#7A1E1E";
const CORAL = "#E7A390";
const INK = "#1b1b1b";
const DOT = "#EBC7BD";

const loadImage = (src) =>
  new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

// paragraph with optional justification (all lines but last)
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

export const VisualPreview = ({ post: postProp, onVisualChange }) => {
  const studio = useStudio();
  const post = postProp || studio.post;
  const updateVisual = onVisualChange || studio.updateVisual;

  const canvasRef = useRef(null);
  const v = post.visual || {};
  const [version, setVersion] = useState(v.recommended_format === "B" ? "B" : "A");
  const [title, setTitle] = useState(v.title_short || post.editorial?.fact || post.meta?.topic || "");
  const [imgSrc, setImgSrc] = useState(v.image || post.meta?.image_url || "");
  const [logoImg, setLogoImg] = useState(null);
  const [mainImg, setMainImg] = useState(null);
  const [sourceLogo, setSourceLogo] = useState(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const imgInput = useRef(null);
  const logoInput = useRef(null);

  useEffect(() => setTitle(v.title_short || post.editorial?.fact || post.meta?.topic || ""), [v.title_short]);

  useEffect(() => {
    let cancelled = false;
    const fonts = [
      "120px Anton",
      "800 60px Outfit",
      "500 28px Outfit",
      "700 44px Caveat",
      "140px Anton",
    ];
    Promise.all(fonts.map((f) => document.fonts.load(f)))
      .then(() => !cancelled && setFontsReady(true))
      .catch(() => !cancelled && setFontsReady(true));
    const t = setTimeout(() => !cancelled && setFontsReady(true), 1600);
    loadImage("/forsides-logo.png").then((img) => !cancelled && setLogoImg(img));
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    loadImage(imgSrc).then(setMainImg);
  }, [imgSrc]);

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, title, mainImg, logoImg, sourceLogo, fontsReady, post.visual, post.editorial, post.meta]);

  const drawHeader = (ctx) => {
    ctx.fillStyle = BLUSH;
    ctx.fillRect(0, 0, W, H);

    // NEWS slab
    ctx.textBaseline = "alphabetic";
    ctx.font = "118px Anton";
    const label = "NEWS";
    const tw = ctx.measureText(label).width;
    const padX = 22;
    const rectX = PAD;
    const rectY = 52;
    const rectH = 128;
    ctx.fillStyle = BRICK;
    ctx.fillRect(rectX, rectY, tw + padX * 2, rectH);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, rectX + padX, rectY + rectH - 26);
    ctx.restore();
    const bannerRight = rectX + tw + padX * 2;
    const bannerBottom = rectY + rectH;

    // date under banner (right aligned to banner)
    ctx.fillStyle = INK;
    ctx.font = "500 32px Outfit";
    ctx.textAlign = "right";
    ctx.fillText((post.meta?.date_label || "").toUpperCase(), bannerRight, bannerBottom + 40);
    ctx.textAlign = "left";

    // FORSIDES logo top-right
    let logoBottom = 60;
    if (logoImg) {
      const lh = 88;
      const lw = (logoImg.width / logoImg.height) * lh;
      ctx.drawImage(logoImg, W - PAD - lw, 50, lw, lh);
      logoBottom = 50 + lh;
    }

    // source logo or name under FORSIDES
    if (sourceLogo) {
      const sh = 60;
      const sw = Math.min((sourceLogo.width / sourceLogo.height) * sh, 260);
      ctx.drawImage(sourceLogo, W - PAD - sw, logoBottom + 18, sw, sh);
    } else if (post.meta?.source) {
      ctx.fillStyle = "#333";
      ctx.font = "600 22px Outfit";
      ctx.textAlign = "right";
      ctx.fillText(post.meta.source, W - PAD, logoBottom + 40);
      ctx.textAlign = "left";
    }

    return bannerBottom + 40;
  };

  const drawSignature = (ctx) => {
    const y = H - 78;
    ctx.fillStyle = BORDEAUX;
    ctx.font = "700 44px Caveat";
    ctx.textAlign = "center";
    const text = "For you, by your side";
    const tw = ctx.measureText(text).width;
    ctx.fillText(text, W / 2, y);
    ctx.textAlign = "left";
    // side lines with diamonds
    ctx.strokeStyle = BORDEAUX;
    ctx.fillStyle = BORDEAUX;
    ctx.lineWidth = 2;
    const gap = 34;
    const leftEnd = W / 2 - tw / 2 - gap;
    const rightStart = W / 2 + tw / 2 + gap;
    const ly = y - 14;
    ctx.beginPath();
    ctx.moveTo(PAD + 120, ly);
    ctx.lineTo(leftEnd, ly);
    ctx.moveTo(rightStart, ly);
    ctx.lineTo(W - PAD - 120, ly);
    ctx.stroke();
    [leftEnd + 12, rightStart - 12].forEach((dx) => {
      ctx.save();
      ctx.translate(dx, ly);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    });
  };

  const drawDots = (ctx, ox, oy, cols, rows) => {
    ctx.fillStyle = DOT;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.beginPath();
        ctx.arc(ox + c * 26, oy + r * 26, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const headerBottom = drawHeader(ctx);

    if (version === "A") {
      ctx.fillStyle = BORDEAUX;
      ctx.font = "800 58px Outfit";
      ctx.textAlign = "left";
      const titleTop = Math.max(headerBottom + 120, 320);
      const titleBottom = drawParagraph(ctx, title, PAD, titleTop, W - PAD * 2, 70, true);

      const imgTop = titleBottom + 30;
      const imgBottom = H - 168;
      const iw = W;
      const ih = imgBottom - imgTop;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, imgTop, iw, ih);
      ctx.clip();
      if (mainImg) {
        const ar = mainImg.width / mainImg.height;
        const tar = iw / ih;
        let dw, dh, dx, dy;
        if (ar > tar) {
          dh = ih;
          dw = ih * ar;
          dx = (iw - dw) / 2;
          dy = imgTop;
        } else {
          dw = iw;
          dh = iw / ar;
          dx = 0;
          dy = imgTop - (dh - ih) / 2;
        }
        ctx.drawImage(mainImg, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = "#ecd9d3";
        ctx.fillRect(0, imgTop, iw, ih);
        ctx.fillStyle = "#a9776c";
        ctx.font = "500 26px Outfit";
        ctx.textAlign = "center";
        ctx.fillText("Ajoutez ou générez une image →", W / 2, imgTop + ih / 2);
        ctx.textAlign = "left";
      }
      ctx.restore();

      drawSignature(ctx);
    } else {
      // Version B — data / infographic
      ctx.fillStyle = BORDEAUX;
      ctx.font = "800 46px Outfit";
      ctx.textAlign = "left";
      const titleTop = Math.max(headerBottom + 90, 300);
      const titleBottom = drawParagraph(ctx, title, PAD, titleTop, W - PAD * 2, 56, true);

      const colGap = 60;
      const leftX = PAD;
      const leftW = (W - PAD * 2 - colGap) * 0.46;
      const rightX = leftX + leftW + colGap;
      const rightW = W - PAD - rightX;
      let ly = titleBottom + 70;

      // big number
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

      // date block
      if (v.important_date) {
        ctx.fillStyle = CORAL;
        ctx.font = "84px Anton";
        const dy = drawParagraph(ctx, String(v.important_date), leftX, ly + 60, leftW, 78, false);
        ctx.fillStyle = INK;
        ctx.font = "500 26px Outfit";
        ctx.fillText("échéance à retenir", leftX, dy + 10);
      }

      // right column headline blocks
      const points = (v.data_points || []).slice(0, 2);
      let ry = titleBottom + 90;
      points.forEach((p, i) => {
        if (ry > H - 470) return;
        ctx.fillStyle = i % 2 === 0 ? CORAL : BORDEAUX;
        ctx.font = "54px Anton";
        ctx.textAlign = "right";
        ry = drawParagraph(ctx, p, rightX + rightW, ry + 48, rightW, 56, false) + 44;
        ctx.textAlign = "left";
      });

      // decorations
      drawDots(ctx, PAD, H - 320, 6, 4);
      ctx.save();
      ctx.fillStyle = BRICK;
      ctx.beginPath();
      ctx.arc(W - 118, H - 258, 88, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = BLUSH;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(W - 118, H - 258);
      ctx.lineTo(W - 22, H - 258);
      ctx.stroke();
      ctx.restore();

      drawSignature(ctx);
    }
  };

  const download = () => {
    try {
      const url = canvasRef.current.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = "forsides-news.png";
      a.click();
      toast.success("Visuel téléchargé (1200×1500)");
    } catch (e) {
      toast.error("Image externe protégée. Importez l'image ou générez-la par IA pour exporter.");
    }
  };

  const exportFull = () => {
    download();
    const blob = new Blob([post.caption || ""], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "forsides-post.txt";
    a.click();
    toast.success("Post complet exporté (visuel + texte)");
  };

  const generate = async () => {
    setBusy(true);
    try {
      const { image } = await genVisual({
        title,
        sector: post.meta?.sector || "",
        topic: post.meta?.topic || post.editorial?.fact || title,
        angle: post.editorial?.angle || "",
      });
      setImgSrc(image);
      updateVisual({ image });
      setVersion("A");
      toast.success("Image générée");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Échec de génération du visuel");
    } finally {
      setBusy(false);
    }
  };

  const onFile = (e, setter, isMain) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (isMain) {
        setImgSrc(reader.result);
        updateVisual({ image: reader.result });
      } else {
        loadImage(reader.result).then(setter);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const saveTitle = () => updateVisual({ title_short: title });

  return (
    <section data-testid="visual-preview" className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-serif text-lg font-bold text-forsides-ink">Visuel LinkedIn · 4:5</h3>
        <div className="flex gap-1 rounded-full bg-slate-100 p-1">
          {["A", "B"].map((f) => (
            <button
              key={f}
              data-testid={`visual-format-${f}`}
              onClick={() => setVersion(f)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                version === f ? "bg-forsides-red text-white" : "text-forsides-slate"
              }`}
            >
              {f === "A" ? "Image" : "Data"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 shadow-inner">
        <canvas ref={canvasRef} width={W} height={H} data-testid="visual-canvas" className="block h-auto w-full" />
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-400">
            <Type className="h-3 w-3" /> Titre du visuel
          </label>
          <input
            data-testid="visual-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-forsides-red focus:ring-2 focus:ring-forsides-red/20"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            data-testid="visual-generate-image"
            disabled={busy}
            onClick={generate}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-sm font-medium text-forsides-slate transition-colors hover:border-forsides-red hover:text-forsides-red disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            Image IA
          </button>
          <button
            data-testid="visual-upload-image"
            onClick={() => imgInput.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-sm font-medium text-forsides-slate transition-colors hover:border-forsides-red hover:text-forsides-red"
          >
            <Upload className="h-4 w-4" /> Importer image
          </button>
          <button
            data-testid="visual-upload-logo"
            onClick={() => logoInput.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-sm font-medium text-forsides-slate transition-colors hover:border-forsides-red hover:text-forsides-red"
          >
            <Upload className="h-4 w-4" /> Logo source
          </button>
          <button
            data-testid="visual-toggle-format"
            onClick={() => setVersion((f) => (f === "A" ? "B" : "A"))}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-sm font-medium text-forsides-slate transition-colors hover:border-forsides-red hover:text-forsides-red"
          >
            <LayoutTemplate className="h-4 w-4" /> Format
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <button
            data-testid="visual-download"
            onClick={download}
            className="inline-flex items-center gap-1.5 rounded-full bg-forsides-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-forsides-bordeaux"
          >
            <Download className="h-4 w-4" /> Télécharger PNG
          </button>
          {post.caption && (
            <button
              data-testid="visual-export-full"
              onClick={exportFull}
              className="inline-flex items-center gap-1.5 rounded-full bg-forsides-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black"
            >
              <FileDown className="h-4 w-4" /> Exporter le post complet
            </button>
          )}
        </div>

        <input ref={imgInput} type="file" accept="image/*" hidden onChange={(e) => onFile(e, setMainImg, true)} />
        <input ref={logoInput} type="file" accept="image/*" hidden onChange={(e) => onFile(e, setSourceLogo, false)} />
      </div>
    </section>
  );
};
