import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useStudio } from "@/context/StudioContext";
import { VisualTextEditor } from "@/components/VisualTextEditor";
import { CarouselDialog } from "@/components/CarouselDialog";
import {
  renderVisual, loadImage, sourceLogoSrc, hasChart, VW, VH, FONT_SET,
} from "@/lib/visualRender";

const FORMAT_LABELS = { A: "Analyse", B: "Data", C: "Graphique" };
const CONCEPT_LABELS = { A: "Analyse", B: "Data / Insight", C: "Graphique" };
const initialFormat = (post) => {
  const f = post.visual?.recommended_format;
  if (f === "C" && hasChart(post)) return "C";
  return f === "B" ? "B" : "A";
};
import {
  Download, LayoutTemplate, Type, Upload, FileDown, Columns2, Check, GalleryHorizontal, Maximize2, X,
} from "lucide-react";

const ConceptThumb = ({ post, version, images, fontsReady, active, onChoose, label }) => {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    renderVisual(c.getContext("2d"), { post, version, images });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.visual, post.meta, post.editorial, images, fontsReady, version]);
  return (
    <button
      type="button"
      data-testid={`concept-${version}`}
      onClick={onChoose}
      className={`group rounded-lg border-2 p-1.5 text-left transition-all ${
        active ? "border-forsides-red shadow-md" : "border-slate-200 hover:border-forsides-red/50"
      }`}
    >
      <canvas ref={ref} width={VW} height={VH} className="block h-auto w-full rounded" />
      <div className="mt-1.5 flex items-center justify-between px-1 pb-0.5">
        <span className="text-xs font-semibold text-forsides-ink">{label}</span>
        {active && <Check className="h-3.5 w-3.5 text-forsides-red" />}
      </div>
    </button>
  );
};

export const VisualPreview = ({ post: postProp, onVisualChange, onThumb, controlsTarget }) => {
  const studio = useStudio();
  const post = postProp || studio.post;
  const updateVisual = onVisualChange || studio.updateVisual;

  const canvasRef = useRef(null);
  const v = post.visual || {};
  const [version, setVersion] = useState(() => initialFormat(post));
  const chartOk = hasChart(post);
  const formats = chartOk ? ["A", "B", "C"] : ["A", "B"];
  const [title, setTitle] = useState(v.title_short || post.editorial?.fact || post.meta?.topic || "");
  const [uploadedLogoSrc, setUploadedLogoSrc] = useState(null);
  const [logoImg, setLogoImg] = useState(null);
  const [sourceLogo, setSourceLogo] = useState(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [showConcepts, setShowConcepts] = useState(false);
  const [showCarousel, setShowCarousel] = useState(false);
  const [zoom, setZoom] = useState(null); // full-screen preview (data URL of the canvas)
  const logoInput = useRef(null);

  // Frozen-column mode: measure the free space and size the canvas to fit it entirely (4:5)
  const fitRef = useRef(null);
  const [fit, setFit] = useState(null);
  useEffect(() => {
    const el = fitRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!width || !height) return setFit(null);
      const w = Math.floor(Math.min(width, height * (VW / VH)));
      setFit({ w, h: Math.floor(w * (VH / VW)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [controlsTarget]);

  useEffect(() => setTitle(v.title_short || post.editorial?.fact || post.meta?.topic || ""), [v.title_short]);

  // new content (e.g. "Optimiser avec l'IA" found figures): follow the recommended format;
  // never stay on "Graphique" if the chart disappeared
  useEffect(() => { setVersion(initialFormat(post)); }, [v.recommended_format, chartOk]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    Promise.all(FONT_SET.map((f) => document.fonts.load(f)))
      .then(() => !cancelled && setFontsReady(true))
      .catch(() => !cancelled && setFontsReady(true));
    const t = setTimeout(() => !cancelled && setFontsReady(true), 1600);
    loadImage("/forsides-logo.png").then((img) => !cancelled && setLogoImg(img));
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  // auto source logo from institution library (unless user uploaded one)
  useEffect(() => {
    if (uploadedLogoSrc) { loadImage(uploadedLogoSrc).then(setSourceLogo); return; }
    const src = sourceLogoSrc(post.meta?.source);
    if (src) loadImage(src).then(setSourceLogo);
    else setSourceLogo(null);
  }, [post.meta?.source, uploadedLogoSrc]);

  const localPost = { ...post, visual: { ...v, title_short: title } };
  const images = { logoImg, sourceLogoImg: sourceLogo };

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    renderVisual(c.getContext("2d"), { post: localPost, version, images });
    if (onThumb) {
      try {
        const t = document.createElement("canvas");
        t.width = 320; t.height = 400;
        t.getContext("2d").drawImage(c, 0, 0, 320, 400);
        onThumb(t.toDataURL("image/jpeg", 0.6));
      } catch (e) { /* tainted */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, title, logoImg, sourceLogo, fontsReady, post.visual, post.editorial, post.meta, post.caption, Boolean(controlsTarget)]);

  const download = () => {
    try {
      const url = canvasRef.current.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url; a.download = "forsides-news.png"; a.click();
      toast.success("Visuel téléchargé (1200×1500)");
    } catch (e) {
      toast.error("Export impossible : le logo importé est protégé. Réimportez-le depuis votre ordinateur.");
    }
  };

  const exportFull = () => {
    download();
    const blob = new Blob([post.caption || ""], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "forsides-post.txt"; a.click();
    toast.success("Post complet exporté (visuel + texte)");
  };

  const onLogoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setUploadedLogoSrc(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const chooseConcept = (f) => { setVersion(f); updateVisual({ recommended_format: f }); setShowConcepts(false); };

  // Settings (concepts, title, text editor, logo, format). In the Studio they are moved into the
  // left column (controlsTarget) so the visual on the right always fits the screen, like frozen panes.
  const controls = (
    <div className="space-y-3">
      {showConcepts && (
        <div data-testid="concept-picker" className="rounded-lg bg-forsides-cream p-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-400">
            Choisissez le concept le plus fort
          </p>
          <div className={`grid gap-3 ${formats.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {formats.map((f, i) => (
              <ConceptThumb key={f} post={localPost} version={f} images={images} fontsReady={fontsReady}
                active={version === f} onChoose={() => chooseConcept(f)} label={`Concept ${i + 1} · ${CONCEPT_LABELS[f]}`} />
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-400">
          <Type className="h-3 w-3" /> Titre du visuel
        </label>
        <input
          data-testid="visual-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => updateVisual({ title_short: title })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-forsides-red focus:ring-2 focus:ring-forsides-red/20"
        />
      </div>

      <VisualTextEditor post={localPost} title={title} version={version} updateVisual={updateVisual} />

      <div className="flex flex-wrap gap-2">
        <button data-testid="visual-upload-logo" onClick={() => logoInput.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-sm font-medium text-forsides-slate transition-colors hover:border-forsides-red hover:text-forsides-red">
          <Upload className="h-4 w-4" /> Logo source
        </button>
        <button data-testid="visual-toggle-format" onClick={() => setVersion((f) => formats[(formats.indexOf(f) + 1) % formats.length])}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-sm font-medium text-forsides-slate transition-colors hover:border-forsides-red hover:text-forsides-red">
          <LayoutTemplate className="h-4 w-4" /> Format
        </button>
      </div>
      <input ref={logoInput} type="file" accept="image/*" hidden onChange={onLogoFile} />
    </div>
  );

  const actions = (
    <div className="flex flex-wrap gap-2">
      <button data-testid="visual-download" onClick={download}
        className="inline-flex items-center gap-1.5 rounded-full bg-forsides-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-forsides-bordeaux">
        <Download className="h-4 w-4" /> Télécharger PNG
      </button>
      <button data-testid="visual-carousel" onClick={() => setShowCarousel(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-forsides-red px-4 py-2 text-sm font-semibold text-forsides-red transition-colors hover:bg-forsides-red hover:text-white">
        <GalleryHorizontal className="h-4 w-4" /> Carrousel PDF
      </button>
      {post.caption && (
        <button data-testid="visual-export-full" onClick={exportFull}
          className="inline-flex items-center gap-1.5 rounded-full bg-forsides-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black">
          <FileDown className="h-4 w-4" /> Exporter le post complet
        </button>
      )}
    </div>
  );

  const split = Boolean(controlsTarget);

  const openZoom = () => {
    try { setZoom(canvasRef.current.toDataURL("image/png")); } catch { /* protected logo: no zoom */ }
  };
  useEffect(() => {
    if (!zoom) return undefined;
    const onKey = (e) => e.key === "Escape" && setZoom(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoom]);

  const iconBtn =
    "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-forsides-slate transition-colors hover:border-forsides-red hover:text-forsides-red";

  // Frozen column: one compact toolbar + the visual using all the remaining height.
  if (split) {
    return (
      <section data-testid="visual-preview" className="flex h-full flex-col">
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
          <div className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-slate-200">
            {formats.map((f) => (
              <button
                key={f}
                data-testid={`visual-format-${f}`}
                onClick={() => setVersion(f)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  version === f ? "bg-forsides-red text-white" : "text-forsides-slate hover:text-forsides-red"
                }`}
              >
                {FORMAT_LABELS[f]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button data-testid="concepts-toggle" onClick={() => setShowConcepts((v2) => !v2)} title="Comparer les concepts (dans Réglages du visuel)" className={iconBtn}>
              <Columns2 className="h-3.5 w-3.5" />
            </button>
            <button data-testid="visual-zoom" onClick={openZoom} title="Agrandir" className={iconBtn}>
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button data-testid="visual-download" onClick={download} title="Télécharger le PNG (1200×1500)"
              className="inline-flex items-center gap-1.5 rounded-full bg-forsides-red px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-forsides-bordeaux">
              <Download className="h-3.5 w-3.5" /> PNG
            </button>
            <button data-testid="visual-carousel" onClick={() => setShowCarousel(true)} title="Carrousel LinkedIn en PDF" className={iconBtn}>
              <GalleryHorizontal className="h-3.5 w-3.5" /> <span className="hidden xl:inline">Carrousel</span>
            </button>
            {post.caption && (
              <button data-testid="visual-export-full" onClick={exportFull} title="Exporter le post complet (visuel + texte)" className={iconBtn}>
                <FileDown className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* the canvas takes all the height left in the frozen column, keeping its 4:5 ratio */}
        <div ref={fitRef} className="flex min-h-0 flex-1 items-start justify-center overflow-hidden">
          <canvas ref={canvasRef} width={VW} height={VH} data-testid="visual-canvas"
            onClick={openZoom}
            title="Cliquer pour agrandir"
            style={fit ? { width: fit.w, height: fit.h } : undefined}
            className={`block cursor-zoom-in rounded-lg border border-slate-200 bg-white shadow-md ${fit ? "" : "h-auto w-full"}`} />
        </div>

        {createPortal(
          <section data-testid="visual-controls" className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h3 className="mb-3 font-serif text-lg font-bold text-forsides-ink">Réglages du visuel</h3>
            {controls}
          </section>,
          controlsTarget
        )}

        {/* Rendered at the page level (portal): inside the frozen column it would sit under the
            sticky top menu, because a sticky element forms its own stacking layer. */}
        {zoom && createPortal(
          <div data-testid="visual-zoom-overlay" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={() => setZoom(null)}>
            <img src={zoom} alt="Visuel en grand" className="max-h-[94vh] max-w-full rounded-lg shadow-2xl" />
            <button aria-label="Fermer" className="absolute right-5 top-5 rounded-full bg-white/90 p-2 text-forsides-ink hover:text-forsides-red">
              <X className="h-5 w-5" />
            </button>
          </div>,
          document.body
        )}
        {showCarousel && createPortal(
          <CarouselDialog post={localPost} images={images} onClose={() => setShowCarousel(false)} />,
          document.body
        )}
      </section>
    );
  }

  return (
    <section
      data-testid="visual-preview"
      className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-lg font-bold text-forsides-ink">Visuel LinkedIn · 4:5</h3>
        <div className="flex items-center gap-2">
          <button
            data-testid="concepts-toggle"
            onClick={() => setShowConcepts((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-forsides-slate transition-colors hover:border-forsides-red hover:text-forsides-red"
          >
            <Columns2 className="h-3.5 w-3.5" /> {formats.length} concepts
          </button>
          <div className="flex gap-1 rounded-full bg-slate-100 p-1">
            {formats.map((f) => (
              <button
                key={f}
                data-testid={`visual-format-${f}`}
                onClick={() => setVersion(f)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  version === f ? "bg-forsides-red text-white" : "text-forsides-slate"
                }`}
              >
                {FORMAT_LABELS[f]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 shadow-inner">
        <canvas ref={canvasRef} width={VW} height={VH} data-testid="visual-canvas" className="block h-auto w-full" />
      </div>

      <div className="mt-4 space-y-3">
        {controls}
        <div className="border-t border-slate-100 pt-3">{actions}</div>
      </div>

      {showCarousel && <CarouselDialog post={localPost} images={images} onClose={() => setShowCarousel(false)} />}
    </section>
  );
};
