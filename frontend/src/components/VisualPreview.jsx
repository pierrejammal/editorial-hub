import React, { useEffect, useRef, useState } from "react";
import { NumInput } from "@/components/NumInput";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useStudio } from "@/context/StudioContext";
import { VisualTextEditor } from "@/components/VisualTextEditor";
import { TemplateEditor } from "@/components/TemplateEditor";
import { renderCarousel, carouselPageLabel } from "@/lib/carouselRender";
import { setAssistView, onAiChange, pageKindForFields } from "@/lib/assistBus";
import { jpegsToPdf } from "@/lib/pdf";
import { prepareLogo } from "@/lib/logoImage";
import { resolveSourceLogo } from "@/lib/sourceLogo";
import {
  renderVisual, loadImage, hasChart, VW, VH, FONT_SET, resolveContent,
} from "@/lib/visualRender";

// "K" = carousel: the preview shows its pages one by one, download gives the PDF
const FORMAT_LABELS = { A: "Analyse", B: "Data", C: "Graphique", K: "Carrousel" };
const CONCEPT_LABELS = { A: "Analyse", B: "Data / Insight", C: "Graphique", K: "Carrousel" };
const initialFormat = (post) => {
  const f = post.visual?.recommended_format;
  if (post.visual?.open_carousel || f === "K") return "K";
  if (f === "C" && hasChart(post)) return "C";
  return f === "B" ? "B" : "A";
};
import {
  Download, LayoutTemplate, Type, Upload, FileDown, Columns2, Check, GalleryHorizontal, Maximize2, X, Move, Trash2,
} from "lucide-react";

const ConceptThumb = ({ post, version, images, fontsReady, active, onChoose, label, template }) => {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    // a drawing bug must never crash the whole page: log it and keep the app usable
    try {
      if (version === "K") { // carousel concept: its cover
        const [cover] = renderCarousel(post, images, (w, h) => { const x = document.createElement("canvas"); x.width = w; x.height = h; return x; }, template);
        const ctx = c.getContext("2d");
        ctx.clearRect(0, 0, VW, VH);
        ctx.drawImage(cover, 0, 0);
      } else renderVisual(c.getContext("2d"), { post, version, images, template });
    } catch (e) { console.error("concept render failed", e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.visual, post.meta, post.editorial, images, fontsReady, version, template]);
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

export const VisualPreview = ({ post: postProp, onVisualChange, onThumb, frozen = false }) => {
  const studio = useStudio();
  const post = postProp || studio.post;
  const template = studio.template;
  const updateVisual = onVisualChange || studio.updateVisual;

  const canvasRef = useRef(null);
  const v = post.visual || {};
  const [version, setVersion] = useState(() => initialFormat(post));
  const chartOk = hasChart(post);
  const formats = chartOk ? ["A", "B", "C", "K"] : ["A", "B", "K"];
  const concepts = formats; // the carousel is a concept too
  const [carPage, setCarPage] = useState(0);
  const [carCount, setCarCount] = useState(0);
  const [carKinds, setCarKinds] = useState([]);
  // click on an element of a carousel page → its own size / position controls
  const [elBoxes, setElBoxes] = useState([]);
  const [hoverKey, setHoverKey] = useState(null);
  const [selEl, setSelEl] = useState(null);
  const deleteSelRef = useRef(null);
  const isCarousel = version === "K";
  // "Mis à jour par l'IA": flash + badge on the preview, and the carousel page to jump to
  const [aiFlash, setAiFlash] = useState(null);
  const jumpKindRef = useRef(null);
  useEffect(() => onAiChange(({ fields = [], format, labels = [] }) => {
    if (format) setVersion(format);
    jumpKindRef.current = pageKindForFields(fields);
    setAiFlash({ at: Date.now(), text: labels.length ? labels.slice(0, 3).join(", ") : "visuel" });
  }), []);
  useEffect(() => {
    if (!aiFlash) return undefined;
    const t = setTimeout(() => setAiFlash(null), 2800);
    return () => clearTimeout(t);
  }, [aiFlash]);
  const [title, setTitle] = useState(v.title_short || post.editorial?.fact || post.meta?.topic || "");
  // the imported logo is stored with the post (visual.source_logo), so it survives reloads and saves
  const uploadedLogoSrc = v.source_logo || null;
  const [logoImg, setLogoImg] = useState(null);
  const [sourceLogo, setSourceLogo] = useState(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [showConcepts, setShowConcepts] = useState(false);
  // opened right away when "Carrousel" was chosen on the home page
  // "Carrousel" chosen on the home page: start on the carousel format
  useEffect(() => {
    if (v.open_carousel) updateVisual({ open_carousel: false, recommended_format: "K" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [zoom, setZoom] = useState(null); // full-screen preview (data URL of the canvas)
  const logoInput = useRef(null);

  // Frozen-column mode: measure the free space and size the canvas to fit it entirely (4:5)
  // Frozen column: the visual is sized so it fits entirely in the visible height of the column,
  // leaving the top of "Réglages du visuel" peeking below it (the column scrolls to reach them).
  const panelRef = useRef(null);
  const [fit, setFit] = useState(null);
  useEffect(() => {
    const el = panelRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => {
      const width = el.clientWidth - 8; // room for the scrollbar
      const height = el.clientHeight - 52 /* toolbar */ - 56 /* settings peek */;
      if (width <= 0 || height <= 0) return setFit(null);
      const w = Math.floor(Math.min(width, height * (VW / VH)));
      setFit({ w, h: Math.floor(w * (VH / VW)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [frozen]);

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

  // source logo: imported > institution library > found on the source's website (or hidden)
  const [logoOrigin, setLogoOrigin] = useState("none");
  useEffect(() => {
    let cancelled = false;
    resolveSourceLogo(post).then(({ img, origin }) => {
      if (cancelled) return;
      setSourceLogo(img);
      setLogoOrigin(origin);
    });
    return () => { cancelled = true; };
  }, [post.meta?.source, post.meta?.source_logo_url, uploadedLogoSrc, v.hide_source_logo]); // eslint-disable-line react-hooks/exhaustive-deps

  const localPost = { ...post, visual: { ...v, title_short: title } };
  const images = { logoImg, sourceLogoImg: sourceLogo };

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    let thumbSrc = c;
    try {
      if (isCarousel) {
        const pages = renderCarousel(localPost, images, (w, h) => { const x = document.createElement("canvas"); x.width = w; x.height = h; return x; }, template);
        const n = pages.length;
        setCarCount(n);
        const kinds = pages.map((p) => p.pageKind);
        setCarKinds((old) => (old.join() === kinds.join() ? old : kinds));
        let pg = Math.min(carPage, n - 1);
        // the AI just changed something: show the page where it appears
        if (jumpKindRef.current) {
          const idx = pages.findIndex((p) => p.pageKind === jumpKindRef.current);
          jumpKindRef.current = null;
          if (idx >= 0) pg = idx;
        }
        if (pg !== carPage) setCarPage(pg);
        setAssistView({ format: "K", page: pg, pageCount: n, pageKind: pages[pg].pageKind, pageLabel: carouselPageLabel(pages[pg].pageKind) });
        const ctx = c.getContext("2d");
        ctx.clearRect(0, 0, VW, VH);
        ctx.drawImage(pages[pg], 0, 0);
        thumbSrc = pages[0]; // "Mes posts" shows the cover
        setElBoxes(pages[pg].elBoxes || []);
      } else {
        renderVisual(c.getContext("2d"), { post: localPost, version, images, template });
        setAssistView({ format: version, page: 0, pageCount: 0, pageKind: null, pageLabel: "" });
        jumpKindRef.current = null;
      }
    } catch (e) {
      console.error("visual render failed", e); // a drawing bug must never crash the whole page
      return;
    }
    if (onThumb) {
      try {
        const t = document.createElement("canvas");
        t.width = 320; t.height = 400;
        t.getContext("2d").drawImage(thumbSrc, 0, 0, 320, 400);
        onThumb(t.toDataURL("image/jpeg", 0.6));
      } catch (e) { /* tainted */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, carPage, title, logoImg, sourceLogo, fontsReady, post.visual, post.editorial, post.meta, post.caption, frozen, template]);

  const downloadPdf = () => {
    try {
      const pages = renderCarousel(localPost, images, (w, h) => { const x = document.createElement("canvas"); x.width = w; x.height = h; return x; }, template);
      const blob = jpegsToPdf(pages.map((p) => ({ dataUrl: p.toDataURL("image/jpeg", 0.92), width: p.width, height: p.height })));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "forsides-carrousel.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast.success(`Carrousel téléchargé (${pages.length} pages) · LinkedIn : « Ajouter un document »`);
    } catch (e) {
      toast.error("Export impossible : le logo importé est protégé. Réimportez-le depuis votre ordinateur.");
    }
  };

  const download = () => {
    if (isCarousel) { downloadPdf(); return; }
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
    reader.onload = async () => {
      try {
        const logo = await prepareLogo(reader.result); // trims empty margins, limits size
        updateVisual({ source_logo: logo });
        toast.success("Logo importé : ajustez sa taille avec le curseur");
      } catch {
        toast.error("Image illisible, essayez un PNG ou un JPG");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const chooseConcept = (f) => { setVersion(f); updateVisual({ recommended_format: f }); setShowConcepts(false); };

  // Settings (concepts, title, text editor, template, logo, format), shown under the visual.
  const controls = (
    <div className="space-y-3">
      {showConcepts && (
        <div data-testid="concept-picker" className="rounded-lg bg-forsides-cream p-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-400">
            Choisissez le concept le plus fort
          </p>
          <div className={`grid gap-3 ${concepts.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
            {concepts.map((f, i) => (
              <ConceptThumb key={f} post={localPost} version={f} images={images} fontsReady={fontsReady} template={template}
                active={version === f} onChoose={() => chooseConcept(f)} label={`Concept ${i + 1} · ${CONCEPT_LABELS[f]}`} />
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-400">
          <Type className="h-3 w-3" /> Titre du visuel
        </label>
        {/* Enter = new line in the title; the title shrinks on the visual to always fit */}
        <textarea
          data-testid="visual-title-input"
          rows={Math.min(5, Math.max(2, String(title).split("\n").length))}
          value={title}
          onChange={(e) => { setTitle(e.target.value); updateVisual({ title_short: e.target.value }); }}
          className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-forsides-red focus:ring-2 focus:ring-forsides-red/20"
        />
        <p className="mt-1 text-[11px] text-slate-400">Entrée = retour à la ligne. Pas de limite : le titre s'adapte pour rester dans la page.</p>
      </div>

      <VisualTextEditor post={localPost} title={title} version={version} updateVisual={updateVisual}
        carKinds={carKinds} carPage={carPage} onCarPage={setCarPage} />

      <TemplateEditor version={version} pageIndex={carPage} />

      <div className="flex flex-wrap gap-2">
        <button data-testid="visual-upload-logo" onClick={() => logoInput.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-sm font-medium text-forsides-slate transition-colors hover:border-forsides-red hover:text-forsides-red">
          <Upload className="h-4 w-4" /> {uploadedLogoSrc ? "Changer le logo" : "Logo source"}
        </button>
        {uploadedLogoSrc && (
          <button data-testid="visual-remove-logo" onClick={() => updateVisual({ source_logo: null })}
            className="rounded-full px-3 py-2 text-sm font-medium text-forsides-slate hover:text-forsides-red">
            Retirer le logo importé
          </button>
        )}
        <button data-testid="visual-toggle-format" onClick={() => setVersion((f) => formats[(formats.indexOf(f) + 1) % formats.length])}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-sm font-medium text-forsides-slate transition-colors hover:border-forsides-red hover:text-forsides-red">
          <LayoutTemplate className="h-4 w-4" /> Format
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-forsides-slate">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" data-testid="visual-show-source-logo" checked={!v.hide_source_logo}
            onChange={(e) => updateVisual({ hide_source_logo: !e.target.checked })} />
          Afficher le logo de la source
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" data-testid="visual-show-date" checked={!v.hide_date}
            onChange={(e) => updateVisual({ hide_date: !e.target.checked })} />
          Afficher la date
        </label>
        {!v.hide_source_logo && (
          <span className="text-slate-400">
            {{ upload: "Logo importé", library: "Logo officiel (bibliothèque)", site: "Logo trouvé sur le site de la source",
              none: "Aucun logo trouvé : le nom de la source est affiché" }[logoOrigin] || ""}
          </span>
        )}
      </div>
      {sourceLogo && (
        <label className="flex items-center gap-3 text-xs text-forsides-slate">
          <span className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-widest text-slate-400">Taille du logo</span>
          <input
            type="range"
            data-testid="visual-logo-size"
            min="0.6"
            max="2"
            step="0.05"
            value={Number(v.source_logo_scale) || 1.3}
            onChange={(e) => updateVisual({ source_logo_scale: Number(e.target.value) })}
            className="w-full accent-forsides-red"
          />
          <NumInput value={Number(v.source_logo_scale) || 1.3} min={60} max={200} scale={100} suffix="%" label="Taille du logo (%)"
            onChange={(n) => updateVisual({ source_logo_scale: n })} />
        </label>
      )}
      <input ref={logoInput} type="file" accept="image/*" hidden onChange={onLogoFile} />
    </div>
  );

  const actions = (
    <div className="flex flex-wrap gap-2">
      <button data-testid="visual-download" onClick={download}
        className="inline-flex items-center gap-1.5 rounded-full bg-forsides-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-forsides-bordeaux">
        <Download className="h-4 w-4" /> {isCarousel ? "Télécharger le PDF" : "Télécharger PNG"}
      </button>
      <button data-testid="visual-carousel" onClick={() => setVersion("K")}
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

  const split = Boolean(frozen);

  // page navigation shown on top of the preview in carousel format
  const navBtn = "absolute top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-2.5 py-1 text-lg leading-none text-forsides-ink shadow hover:bg-forsides-red hover:text-white disabled:opacity-30";
  const carNav = (
    <>
      <button type="button" aria-label="Page précédente" data-testid="carousel-prev" disabled={carPage <= 0}
        onClick={(e) => { e.stopPropagation(); setCarPage((p) => Math.max(0, p - 1)); }} className={`${navBtn} left-2`}>‹</button>
      <button type="button" aria-label="Page suivante" data-testid="carousel-next" disabled={carPage >= carCount - 1}
        onClick={(e) => { e.stopPropagation(); setCarPage((p) => Math.min(carCount - 1, p + 1)); }} className={`${navBtn} right-2`}>›</button>
      <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-forsides-ink/85 px-3 py-1 font-mono text-[11px] text-white">
        Page {Math.min(carPage + 1, carCount || 1)} / {carCount || 1}
      </span>
    </>
  );

  // re-keyed on each AI change so the animation replays
  const aiBadge = aiFlash && (
    <React.Fragment key={aiFlash.at}>
      <span aria-hidden="true" className="ai-flash-ring pointer-events-none absolute inset-0 rounded-lg" />
      <span role="status" data-testid="ai-updated-badge"
        className="ai-flash-badge pointer-events-none absolute left-1/2 top-3 max-w-[90%] -translate-x-1/2 truncate rounded-full bg-forsides-ink px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg">
        ✓ Mis à jour par l'IA · {aiFlash.text}
      </span>
    </React.Fragment>
  );

  // "Déplacer": drag the text up or down directly on the preview (same setting as "Position du texte")
  const [moveMode, setMoveMode] = useState(false);

  const openZoom = () => {
    try { setZoom(canvasRef.current.toDataURL("image/png")); } catch { /* protected logo: no zoom */ }
  };

  // ---------- click selection of an element (carousel) ----------
  useEffect(() => { setSelEl(null); setHoverKey(null); }, [carPage, version]);
  useEffect(() => {
    if (!selEl) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setSelEl(null);
      // Suppr / ⌫ deletes the selected element (not while typing in a field)
      const typing = /input|textarea|select/i.test(e.target?.tagName || "") || e.target?.isContentEditable;
      if ((e.key === "Delete" || e.key === "Backspace") && !typing) { e.preventDefault(); deleteSelRef.current?.(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selEl]);
  const hitAt = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) * VW) / r.width;
    const y = ((e.clientY - r.top) * VH) / r.height;
    const pad = 12;
    const hits = elBoxes.filter((b) => x >= b.x0 - pad && x <= b.x1 + pad && y >= b.y0 - pad && y <= b.y1 + pad);
    hits.sort((a, b) => (a.x1 - a.x0) * (a.y1 - a.y0) - (b.x1 - b.x0) * (b.y1 - b.y0)); // smallest first
    return hits[0] || null;
  };
  const canvasClick = (e) => {
    if (moveMode) return;
    if (isCarousel) {
      const hit = hitAt(e);
      if (hit) { setSelEl(hit.key); return; }
      if (selEl) { setSelEl(null); return; }
    }
    openZoom();
  };
  const canvasHover = isCarousel && !moveMode ? {
    onMouseMove: (e) => { const h = hitAt(e); const k = h ? h.key : null; if (k !== hoverKey) setHoverKey(k); },
    onMouseLeave: () => setHoverKey(null),
  } : {};
  const EL_NAMES = { heading: "Titre de la page", title: "Titre", source: "Source", figure: "Chiffre clé", summary: "Résumé",
    facts: "Faits", chartTitle: "Titre du graphique", chart: "Graphique", note: "Phrase sous le graphique", date: "Échéance",
    quote: "Message", cta: "Question et appel de fin", body: "Contenu de la page",
    banner: "Bandeau NEWS", logo: "Logo FORSIDES", sourceLogo: "Logo de la source", pageNum: "Numéro de page",
    swipe: "« Faites défiler »", separators: "Séparateur", quoteOpen: "Guillemet ouvrant", quoteClose: "Guillemet fermant",
    rule: "Filet", signature: "Signature" };
  const elName = (key) => {
    const id = String(key || "").split(":").slice(1).join(":");
    if (id.startsWith("pt-")) return `Point ${Number(id.slice(3)) + 1}`;
    if (id.startsWith("blk-")) return "Partie ajoutée";
    return EL_NAMES[id] || id;
  };
  const boxOf = (key) => elBoxes.find((b) => b.key === key);
  const pct = (n, total) => `${(n / total) * 100}%`;
  const outline = (key, strong) => {
    const b = boxOf(key);
    if (!b) return null;
    return (
      <span key={`o-${key}`} aria-hidden="true" className={`pointer-events-none absolute rounded ${strong ? "border-2 border-forsides-red" : "border border-dashed border-forsides-red/70"}`}
        style={{ left: pct(b.x0 - 10, VW), top: pct(b.y0 - 10, VH), width: pct(b.x1 - b.x0 + 20, VW), height: pct(b.y1 - b.y0 + 20, VH) }} />
    );
  };
  const elAll = v.el || {};
  const selCur = selEl ? elAll[selEl] || {} : {};
  const setSel = (patch) => updateVisual({ el: { ...elAll, [selEl]: { ...selCur, ...patch } } });
  const selBox = selEl ? boxOf(selEl) : null;
  // "Masquer": the source is switched off with the page's source setting, the rest with visual.hidden
  const hideSel = () => {
    const [kind, ...rest] = String(selEl).split(":");
    const id = rest.join(":");
    if (id === "source") updateVisual({ page_source: { ...(v.page_source || {}), [kind]: false } });
    else updateVisual({ hidden: { ...(v.hidden || {}), [`${kind}.${id}`]: true } });
    setSelEl(null);
    toast.message("Élément masqué", { description: "Pour le remettre : « Modifier le texte du visuel » → Taille et position de chaque élément." });
  };
  // "Supprimer": removes the element for good when it is content (a point, an added section, an added
  // page), otherwise it is hidden (fixed parts of the template). Always undoable from the message.
  const deleteSel = () => {
    if (!selEl) return;
    const [kind, ...rest] = String(selEl).split(":");
    const id = rest.join(":");
    const before = {
      page_blocks: v.page_blocks, custom: v.custom, extra_pages: v.extra_pages, hidden: v.hidden, page_source: v.page_source,
    };
    let what = "Élément supprimé";
    if (id.startsWith("blk-")) {
      const bid = id.slice(4);
      const pb = { ...(v.page_blocks || {}) };
      pb[kind] = (pb[kind] || []).filter((b) => b.id !== bid);
      updateVisual({ page_blocks: pb });
      what = "Partie supprimée";
    } else if (id.startsWith("pt-")) {
      const shownPts = resolveContent(localPost, title).points;
      const target = shownPts[Number(id.slice(3))];
      const base = Array.isArray(v.custom?.points) ? v.custom.points : shownPts;
      const idx = base.findIndex((p) => p && target && (p.label || "") === (target.label || "") && (p.text || "") === (target.text || ""));
      if (idx < 0) return;
      updateVisual({ custom: { ...(v.custom || {}), points: base.filter((_, i) => i !== idx) } });
      what = "Point supprimé";
    } else if (kind.startsWith("extra-") && id === "body") {
      updateVisual({ extra_pages: (v.extra_pages || []).filter((x) => `extra-${x.id}` !== kind) });
      setCarPage((p) => Math.max(0, p - 1));
      what = "Page supprimée";
    } else if (id === "source") {
      updateVisual({ page_source: { ...(v.page_source || {}), [kind]: false } });
      what = "Source retirée de la page";
    } else {
      updateVisual({ hidden: { ...(v.hidden || {}), [`${kind}.${id}`]: true } });
      what = "Élément retiré de la page";
    }
    setSelEl(null);
    setHoverKey(null);
    toast.success(what, { action: { label: "Annuler", onClick: () => updateVisual(before) } });
  };
  deleteSelRef.current = deleteSel;
  const elPopover = selEl && selBox && (
    <div data-testid="visual-el-popover" onClick={(e) => e.stopPropagation()}
      className="absolute z-20 w-72 rounded-xl bg-white p-3 text-xs shadow-xl ring-1 ring-slate-200"
      style={{
        left: `min(${pct(Math.max(0, selBox.x0), VW)}, calc(100% - 18.5rem))`,
        ...(selBox.y1 / VH > 0.62 ? { bottom: pct(VH - selBox.y0 + 16, VH) } : { top: pct(selBox.y1 + 16, VH) }),
      }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-forsides-ink">{elName(selEl)}</span>
        <button type="button" aria-label="Fermer" onClick={() => setSelEl(null)} className="text-slate-400 hover:text-forsides-red"><X className="h-3.5 w-3.5" /></button>
      </div>
      <label className="flex items-center gap-2 text-forsides-slate">
        <span className="w-14">Taille</span>
        <input type="range" min={0.5} max={1.6} step={0.05} value={Number(selCur.s) || 1} data-testid="visual-el-size"
          onChange={(e) => setSel({ s: Number(e.target.value) })} className="flex-1 accent-[#C0453A]" />
        <NumInput value={Number(selCur.s) || 1} min={50} max={160} scale={100} suffix="%" label="Taille (%)" testid="visual-el-size-num"
          className="w-14" onChange={(n) => setSel({ s: n })} />
      </label>
      <label className="mt-1.5 flex items-center gap-2 text-forsides-slate">
        <span className="w-14">Horizontal</span>
        <input type="range" min={-400} max={400} step={5} value={Number(selCur.x) || 0} data-testid="visual-el-x"
          onChange={(e) => setSel({ x: Number(e.target.value) })} className="flex-1 accent-[#C0453A]" />
        <NumInput value={Number(selCur.x) || 0} min={-500} max={500} label="Horizontal (négatif = à gauche)" testid="visual-el-x-num"
          className="w-14" onChange={(n) => setSel({ x: n })} />
      </label>
      <label className="mt-1.5 flex items-center gap-2 text-forsides-slate">
        <span className="w-14">Vertical</span>
        <input type="range" min={-300} max={300} step={5} value={Number(selCur.y) || 0} data-testid="visual-el-pos"
          onChange={(e) => setSel({ y: Number(e.target.value) })} className="flex-1 accent-[#C0453A]" />
        <NumInput value={Number(selCur.y) || 0} min={-400} max={400} label="Vertical (négatif = plus haut)" testid="visual-el-y-num"
          className="w-14" onChange={(n) => setSel({ y: n })} />
      </label>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="flex gap-1">
          <button type="button" aria-label="Monter" onClick={() => setSel({ y: Math.max(-300, (Number(selCur.y) || 0) - 10) })} className="rounded bg-slate-100 px-2 py-0.5 hover:bg-slate-200">↑</button>
          <button type="button" aria-label="Descendre" onClick={() => setSel({ y: Math.min(300, (Number(selCur.y) || 0) + 10) })} className="rounded bg-slate-100 px-2 py-0.5 hover:bg-slate-200">↓</button>
          <button type="button" aria-label="Plus petit" onClick={() => setSel({ s: Math.max(0.5, Math.round(((Number(selCur.s) || 1) - 0.05) * 100) / 100) })} className="rounded bg-slate-100 px-2 py-0.5 hover:bg-slate-200">A−</button>
          <button type="button" aria-label="Plus grand" onClick={() => setSel({ s: Math.min(1.6, Math.round(((Number(selCur.s) || 1) + 0.05) * 100) / 100) })} className="rounded bg-slate-100 px-2 py-0.5 hover:bg-slate-200">A+</button>
        </span>
        <button type="button" data-testid="visual-el-hide" onClick={hideSel} className="text-slate-500 hover:text-forsides-red">Masquer</button>
        <button type="button" data-testid="visual-el-delete" onClick={deleteSel} title="Supprimer (touche Suppr)"
          className="inline-flex items-center gap-1 font-semibold text-forsides-red hover:text-forsides-bordeaux">
          <Trash2 className="h-3.5 w-3.5" /> Supprimer
        </button>
        {(selCur.s || selCur.y || selCur.x) ? (
          <button type="button" onClick={() => { const next = { ...elAll }; delete next[selEl]; updateVisual({ el: next }); }}
            className="text-slate-400 hover:text-forsides-red">Rétablir</button>
        ) : null}
      </div>
    </div>
  );
  const selectionLayer = isCarousel && (
    <>
      {hoverKey && hoverKey !== selEl && outline(hoverKey, false)}
      {selEl && outline(selEl, true)}
      {elPopover}
    </>
  );
  const dragRef = useRef(null);
  const posKey = isCarousel ? `k:${carKinds[carPage] || "cover"}` : (version === "C" && !chartOk ? "A" : version);
  const dragProps = moveMode ? {
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      dragRef.current = { y: e.clientY, base: Number((v.content_offset || {})[posKey]) || 0, h: e.currentTarget.getBoundingClientRect().height };
    },
    onPointerMove: (e) => {
      const d = dragRef.current;
      if (!d) return;
      const off = Math.max(-400, Math.min(400, Math.round((d.base + ((e.clientY - d.y) * VH) / d.h) / 5) * 5));
      if (off !== d.last) {
        d.last = off;
        updateVisual({ content_offset: { ...(v.content_offset || {}), [posKey]: off } });
      }
    },
    onPointerUp: () => { dragRef.current = null; },
    onPointerCancel: () => { dragRef.current = null; },
    style: { cursor: "ns-resize", touchAction: "none" },
  } : {};
  const moveBtn = (
    <button type="button" data-testid="visual-move" onClick={() => setMoveMode((m) => !m)}
      title="Déplacer le texte : glissez vers le haut ou le bas sur l'aperçu"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
        moveMode ? "border-forsides-red bg-forsides-red text-white" : "border-slate-200 bg-white text-forsides-slate hover:border-forsides-red hover:text-forsides-red"}`}>
      <Move className="h-3.5 w-3.5" /> Déplacer
    </button>
  );
  const moveHint = moveMode && (
    <span className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-forsides-red px-3 py-1 text-xs font-semibold text-white shadow">
      ↕ Glissez le texte vers le haut ou le bas
    </span>
  );

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
      <section ref={panelRef} data-testid="visual-preview" className="h-full overflow-y-auto overscroll-contain pr-2">
        <div className="sticky top-0 z-10 flex h-[52px] items-center justify-between gap-2 bg-forsides-cream/95 backdrop-blur-sm">
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
            {moveBtn}
            <button data-testid="visual-zoom" onClick={openZoom} title="Agrandir" className={iconBtn}>
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button data-testid="visual-download" onClick={download}
              title={isCarousel ? "Télécharger le carrousel en PDF (LinkedIn : « Ajouter un document »)" : "Télécharger le PNG (1200×1500)"}
              className="inline-flex items-center gap-1.5 rounded-full bg-forsides-red px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-forsides-bordeaux">
              <Download className="h-3.5 w-3.5" /> {isCarousel ? "PDF" : "PNG"}
            </button>
            {post.caption && (
              <button data-testid="visual-export-full" onClick={exportFull} title="Exporter le post complet (visuel + texte)" className={iconBtn}>
                <FileDown className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* the visual fits the visible height of the column, keeping its 4:5 ratio */}
        <div className="flex justify-center">
          <div className="relative">
            <canvas ref={canvasRef} width={VW} height={VH} data-testid="visual-canvas"
              onClick={canvasClick}
              {...canvasHover}
              title={moveMode ? "Glissez pour déplacer le texte" : isCarousel ? "Cliquez sur un texte pour régler sa taille et sa position" : "Cliquer pour agrandir"}
              {...dragProps}
              style={{ ...(fit ? { width: fit.w, height: fit.h } : {}), ...(dragProps.style || {}) }}
              className={`block cursor-zoom-in rounded-lg border bg-white shadow-md ${moveMode ? "border-forsides-red ring-2 ring-forsides-red/40" : "border-slate-200"} ${fit ? "" : "h-auto w-full"}`} />
            {isCarousel && carNav}
            {aiBadge}
            {moveHint}
            {selectionLayer}
          </div>
        </div>

        <section data-testid="visual-controls" className="mt-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-serif text-lg font-bold text-forsides-ink">Réglages du visuel</h3>
          {controls}
        </section>

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
            <Columns2 className="h-3.5 w-3.5" /> {concepts.length} concepts
          </button>
          {moveBtn}
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

      <div className="relative overflow-hidden rounded-lg border border-slate-200 shadow-inner">
        <canvas ref={canvasRef} width={VW} height={VH} data-testid="visual-canvas" className="block h-auto w-full"
          onClick={canvasClick} {...canvasHover} {...dragProps} />
        {isCarousel && carNav}
        {aiBadge}
        {moveHint}
        {selectionLayer}
      </div>

      <div className="mt-4 space-y-3">
        {controls}
        <div className="border-t border-slate-100 pt-3">{actions}</div>
      </div>
    </section>
  );
};
