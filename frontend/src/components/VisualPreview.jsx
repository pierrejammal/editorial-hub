import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useStudio } from "@/context/StudioContext";
import {
  renderVisual, loadImage, sourceLogoSrc, VW, VH, FONT_SET,
} from "@/lib/visualRender";
import {
  Download, LayoutTemplate, Type, Upload, FileDown, Columns2, Check,
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

export const VisualPreview = ({ post: postProp, onVisualChange, onThumb }) => {
  const studio = useStudio();
  const post = postProp || studio.post;
  const updateVisual = onVisualChange || studio.updateVisual;

  const canvasRef = useRef(null);
  const v = post.visual || {};
  const [version, setVersion] = useState(v.recommended_format === "B" ? "B" : "A");
  const [title, setTitle] = useState(v.title_short || post.editorial?.fact || post.meta?.topic || "");
  const [uploadedLogoSrc, setUploadedLogoSrc] = useState(null);
  const [logoImg, setLogoImg] = useState(null);
  const [sourceLogo, setSourceLogo] = useState(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [showConcepts, setShowConcepts] = useState(false);
  const logoInput = useRef(null);

  useEffect(() => setTitle(v.title_short || post.editorial?.fact || post.meta?.topic || ""), [v.title_short]);

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
  }, [version, title, logoImg, sourceLogo, fontsReady, post.visual, post.editorial, post.meta, post.caption]);

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

  return (
    <section data-testid="visual-preview" className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-serif text-lg font-bold text-forsides-ink">Visuel LinkedIn · 4:5</h3>
        <div className="flex items-center gap-2">
          <button
            data-testid="concepts-toggle"
            onClick={() => setShowConcepts((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-forsides-slate transition-colors hover:border-forsides-red hover:text-forsides-red"
          >
            <Columns2 className="h-3.5 w-3.5" /> 2 concepts
          </button>
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
                {f === "A" ? "Analyse" : "Data"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showConcepts && (
        <div data-testid="concept-picker" className="mb-4 rounded-lg bg-forsides-cream p-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-400">
            Choisissez le concept le plus fort
          </p>
          <div className="grid grid-cols-2 gap-3">
            <ConceptThumb post={localPost} version="A" images={images} fontsReady={fontsReady}
              active={version === "A"} onChoose={() => chooseConcept("A")} label="Concept 1 · Analyse" />
            <ConceptThumb post={localPost} version="B" images={images} fontsReady={fontsReady}
              active={version === "B"} onChoose={() => chooseConcept("B")} label="Concept 2 · Data / Insight" />
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 shadow-inner">
        <canvas ref={canvasRef} width={VW} height={VH} data-testid="visual-canvas" className="block h-auto w-full" />
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
            onBlur={() => updateVisual({ title_short: title })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-forsides-red focus:ring-2 focus:ring-forsides-red/20"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button data-testid="visual-upload-logo" onClick={() => logoInput.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-sm font-medium text-forsides-slate transition-colors hover:border-forsides-red hover:text-forsides-red">
            <Upload className="h-4 w-4" /> Logo source
          </button>
          <button data-testid="visual-toggle-format" onClick={() => setVersion((f) => (f === "A" ? "B" : "A"))}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-sm font-medium text-forsides-slate transition-colors hover:border-forsides-red hover:text-forsides-red">
            <LayoutTemplate className="h-4 w-4" /> Format
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <button data-testid="visual-download" onClick={download}
            className="inline-flex items-center gap-1.5 rounded-full bg-forsides-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-forsides-bordeaux">
            <Download className="h-4 w-4" /> Télécharger PNG
          </button>
          {post.caption && (
            <button data-testid="visual-export-full" onClick={exportFull}
              className="inline-flex items-center gap-1.5 rounded-full bg-forsides-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black">
              <FileDown className="h-4 w-4" /> Exporter le post complet
            </button>
          )}
        </div>

        <input ref={logoInput} type="file" accept="image/*" hidden onChange={onLogoFile} />
      </div>
    </section>
  );
};
