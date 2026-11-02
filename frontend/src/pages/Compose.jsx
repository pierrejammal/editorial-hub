import React, { useEffect, useState } from "react";
import { useStudio } from "@/context/StudioContext";
import { toast } from "sonner";
import { BrandHeader } from "@/components/BrandHeader";
import { VisualPreview } from "@/components/VisualPreview";
import { PostActions } from "@/components/PostActions";
import { AssistantPanel } from "@/components/AssistantPanel";
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
  const { compose, setCompose } = useStudio();
  const [text, setText] = useState(compose?.text || "");
  const [busy, setBusy] = useState(false);
  const [thumb, setThumb] = useState("");
  const [post, setPost] = useState(() => compose?.post || {
    meta: { date_label: dateLabel(), source: "" },
    editorial: {},
    visual: { recommended_format: "A", title_short: "" },
    caption: "",
    _lastAuto: "",
  });

  // keep the text and visual when leaving the page (restored on return)
  useEffect(() => { setCompose({ text, post }); }, [text, post]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // The AI lays out the visual automatically, once, as soon as a real text is pasted
  // (no button). Later changes go through the Assistant IA below.
  const optimize = async (t) => {
    setBusy(true);
    try {
      const data = await composeFromText(t);
      setPost((p) => ({
        ...p,
        meta: { ...p.meta, ...data.meta, date_label: p.meta.date_label },
        editorial: { ...p.editorial, ...data.editorial },
        visual: { ...p.visual, ...data.visual },
        _lastAuto: data.visual?.title_short || p._lastAuto,
        _aiDone: true,
        source_text: t,
      }));
    } catch (e) {
      setPost((p) => ({ ...p, _aiDone: true })); // don't retry in a loop; the assistant is still there
      toast.error(e.detail || "Mise en forme automatique impossible : demandez-la à l'Assistant IA");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (busy || post._aiDone || post.editorial?.fact || text.trim().length < 120) return undefined;
    const t = setTimeout(() => optimize(text.trim()), 1200); // wait until the paste/typing settles
    return () => clearTimeout(t);
  }, [text, busy, post._aiDone]); // eslint-disable-line react-hooks/exhaustive-deps

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
            onSaved={(id, scheduled_at) => setPost((p) => ({ ...p, id, scheduled_at }))}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="flex flex-col rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <label className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
                Votre texte LinkedIn
              </label>
              <span className="flex items-center gap-3 font-mono text-xs text-slate-400">
                {text.length} car.
                {text && (
                  <button
                    type="button"
                    data-testid="compose-reset"
                    onClick={() => {
                      if (!window.confirm("Effacer ce texte et repartir de zéro ?")) return;
                      setText("");
                      setPost({ meta: { date_label: dateLabel(), source: "" }, editorial: {},
                        visual: { recommended_format: "A", title_short: "" }, caption: "", _lastAuto: "" });
                    }}
                    className="font-sans font-medium text-forsides-slate hover:text-forsides-red"
                  >
                    Nouveau texte
                  </button>
                )}
              </span>
            </div>
            <textarea
              data-testid="compose-textarea"
              value={text}
              onChange={(e) => onText(e.target.value)}
              rows={20}
              placeholder="Collez ici le texte de votre publication LinkedIn…"
              className="w-full flex-1 resize-none rounded-lg border border-slate-200 bg-forsides-cream/40 p-4 font-sans text-sm leading-relaxed text-forsides-ink outline-none focus:border-forsides-red focus:ring-2 focus:ring-forsides-red/20"
            />
            <p data-testid="compose-auto-status" className="mt-3 inline-flex min-h-5 items-center gap-2 text-xs text-forsides-slate">
              {busy ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Mise en forme du visuel par l'IA…</>
              ) : post._aiDone || post.editorial?.fact ? (
                <><Sparkles className="h-3.5 w-3.5 text-forsides-red" /> Visuel mis en forme. Pour le modifier, écrivez à l'Assistant IA.</>
              ) : (
                "Collez votre texte : le visuel se met en forme automatiquement."
              )}
            </p>
            <div className="mt-6 border-t border-dashed border-slate-300 pt-5">
              <p className="mb-3 font-serif text-lg font-bold text-forsides-ink">Assistant IA</p>
              <AssistantPanel post={{ ...post, caption: text, source_text: post.source_text || text }} setPost={setPost} onCaption={setText} />
            </div>
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
