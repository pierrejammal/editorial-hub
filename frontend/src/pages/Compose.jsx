import React, { useState } from "react";
import { toast } from "sonner";
import { BrandHeader } from "@/components/BrandHeader";
import { VisualPreview } from "@/components/VisualPreview";
import { PostActions } from "@/components/PostActions";
import { composeFromText } from "@/lib/api";
import { Sparkles, Loader2, PenLine } from "lucide-react";

const MONTHS = ["JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET",
  "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE"];
const dateLabel = () => {
  const d = new Date();
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
const derive = (t) => (t.split("\n").find((l) => l.trim().length > 0) || "").trim().slice(0, 90);

const Compose = () => {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [thumb, setThumb] = useState("");
  const [post, setPost] = useState({
    meta: { date_label: dateLabel(), source: "" },
    editorial: {},
    visual: { recommended_format: "A", title_short: "" },
    caption: "",
    _lastAuto: "",
  });

  const onText = (val) => {
    setText(val);
    setPost((p) => {
      const auto = derive(val);
      const manual = p.visual.title_short && p.visual.title_short !== p._lastAuto;
      return {
        ...p,
        caption: val,
        _lastAuto: auto,
        visual: { ...p.visual, title_short: manual ? p.visual.title_short : auto },
      };
    });
  };

  const onVisualChange = (patch) =>
    setPost((p) => ({ ...p, visual: { ...p.visual, ...patch } }));

  const optimize = async () => {
    if (text.trim().length < 30) {
      toast.error("Collez d'abord votre texte LinkedIn");
      return;
    }
    setBusy(true);
    try {
      const data = await composeFromText(text);
      setPost((p) => ({
        ...p,
        meta: { ...p.meta, ...data.meta, date_label: p.meta.date_label },
        editorial: { ...p.editorial, ...data.editorial },
        visual: { ...p.visual, ...data.visual },
        _lastAuto: data.visual?.title_short || p._lastAuto,
        caption: text,
      }));
      toast.success("Visuel optimisé par l'IA");
    } catch (e) {
      toast.error(e.detail || "Échec de l'optimisation");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen paper-grain">
      <BrandHeader />
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-10">
        <div className="rise flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forsides-red/10 text-forsides-red">
              <PenLine className="h-6 w-6" />
            </div>
            <h1 className="mt-5 font-serif text-4xl font-black tracking-tight text-forsides-ink">
              Éditeur libre
            </h1>
            <p className="mt-3 max-w-2xl text-forsides-slate">
              Collez votre texte LinkedIn à gauche, le visuel FORSIDES se compose en direct à droite.
              Optimisez le titre et le format avec l'IA, puis exportez le post complet.
            </p>
          </div>
          <PostActions
            post={post}
            thumb={thumb}
            origin="compose"
            onSaved={(id) => setPost((p) => ({ ...p, id }))}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="flex flex-col rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <label className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
                Votre texte LinkedIn
              </label>
              <span className="font-mono text-xs text-slate-400">{text.length} car.</span>
            </div>
            <textarea
              data-testid="compose-textarea"
              value={text}
              onChange={(e) => onText(e.target.value)}
              rows={20}
              placeholder="Collez ici le texte de votre publication LinkedIn…"
              className="w-full flex-1 resize-none rounded-lg border border-slate-200 bg-forsides-cream/40 p-4 font-sans text-sm leading-relaxed text-forsides-ink outline-none focus:border-forsides-red focus:ring-2 focus:ring-forsides-red/20"
            />
            <button
              data-testid="compose-optimize"
              onClick={optimize}
              disabled={busy}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-forsides-red px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-forsides-bordeaux disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Optimiser le visuel avec l'IA
            </button>
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <VisualPreview post={post} onVisualChange={onVisualChange} onThumb={setThumb} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Compose;
