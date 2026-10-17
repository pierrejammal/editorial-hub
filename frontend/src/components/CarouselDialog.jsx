import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { renderCarousel } from "@/lib/carouselRender";
import { jpegsToPdf } from "@/lib/pdf";
import { X, FileDown, Loader2 } from "lucide-react";

// Preview of the LinkedIn carousel pages + PDF download (LinkedIn: "Ajouter un document").
export const CarouselDialog = ({ post, images, template, onClose }) => {
  const [pages, setPages] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const canvases = renderCarousel(post, images, (w, h) => {
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        return c;
      }, template);
      setPages(canvases.map((c) => ({
        preview: c.toDataURL("image/jpeg", 0.7),
        full: c.toDataURL("image/jpeg", 0.92),
        width: c.width,
        height: c.height,
      })));
    } catch (e) {
      toast.error("Impossible de créer le carrousel (logo importé protégé ?). Réimportez le logo depuis votre ordinateur.");
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const download = () => {
    setBusy(true);
    try {
      const blob = jpegsToPdf(pages.map((p) => ({ dataUrl: p.full, width: p.width, height: p.height })));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "forsides-carrousel.pdf";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast.success(`Carrousel téléchargé (${pages.length} pages)`);
    } catch (e) {
      toast.error("Échec de la création du PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        data-testid="carousel-dialog"
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-serif text-xl font-bold text-forsides-ink">Carrousel LinkedIn</h3>
            <p className="mt-1 text-sm text-forsides-slate">
              {pages.length ? `${pages.length} pages` : "Préparation…"} · sur LinkedIn : « Commencer un post » →
              « Ajouter un document » → choisissez le PDF.
            </p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="text-slate-400 hover:text-forsides-red">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
          {pages.map((p, i) => (
            <img
              key={i}
              src={p.preview}
              alt={`Page ${i + 1}`}
              data-testid={`carousel-page-${i}`}
              className="h-80 w-auto shrink-0 rounded-lg border border-slate-200 shadow-sm"
            />
          ))}
          {!pages.length && <Loader2 className="m-10 h-6 w-6 animate-spin text-forsides-slate" />}
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Le carrousel reprend le texte et les chiffres du visuel : corrigez-les dans « Modifier le texte du visuel »
          puis rouvrez cet aperçu.
        </p>

        <button
          data-testid="carousel-download"
          disabled={!pages.length || busy}
          onClick={download}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-forsides-red px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-forsides-bordeaux disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Télécharger le PDF
        </button>
      </div>
    </div>
  );
};
