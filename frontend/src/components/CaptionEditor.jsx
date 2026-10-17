import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { regenCaption, checkQuality, getStyle } from "@/lib/api";
import { ToneSelect } from "@/components/ToneSelect";
import { useTone } from "@/lib/tone";
import { useStudio } from "@/context/StudioContext";
import {
  RefreshCw,
  Scissors,
  BrainCircuit,
  Compass,
  Sparkles,
  Copy,
  ShieldCheck,
  Loader2,
} from "lucide-react";

const LENGTHS = [
  { key: "court", label: "Court" },
  { key: "standard", label: "Standard" },
  { key: "analytique", label: "Analytique" },
  { key: "decryptage", label: "Décryptage approfondi" },
];

export const CaptionEditor = () => {
  const { post, updateCaption, updateQuality } = useStudio();
  const [length, setLength] = useState("standard");
  const [busy, setBusy] = useState(null);
  const [angleOpen, setAngleOpen] = useState(false);
  const [tone, setTone] = useTone();
  const [avoidList, setAvoidList] = useState([]);
  const ed = post.editorial || {};

  useEffect(() => {
    getStyle().then((s) => setAvoidList(s.avoid || [])).catch(() => {});
  }, []);
  // house "formules à éviter" found in the current text (e.g. after a manual edit)
  const lowCaption = (post.caption || "").toLowerCase();
  const avoidedFound = avoidList.filter((a) => a && lowCaption.includes(a.toLowerCase()));

  const ctx = {
    fact: ed.fact,
    what_changes: ed.what_changes,
    why_important: ed.why_important,
    insight: ed.insight,
    key_figure: ed.key_figure,
    angle: ed.angle,
    source: post.meta?.source,
  };

  const run = async (action, angle) => {
    setBusy(action);
    try {
      const { caption } = await regenCaption({
        context: ctx,
        length,
        action,
        angle,
        current_caption: post.caption,
        tone: tone || null,
        lang: post.meta?.lang || "fr",
      });
      updateCaption(caption);
      toast.success("Caption mis à jour");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Échec de la régénération");
    } finally {
      setBusy(null);
      setAngleOpen(false);
    }
  };

  const runQuality = async () => {
    setBusy("quality");
    try {
      const q = await checkQuality(post.caption, ctx);
      updateQuality(q);
      if ((q.score ?? 0) < 75) toast.warning("Potentiel éditorial à renforcer");
      else toast.success(`Content Quality Score : ${q.score}/100`);
    } catch (e) {
      toast.error("Échec du contrôle qualité");
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(post.caption || "");
      toast.success("Caption copié");
    } catch {
      toast.error("Copie impossible : sélectionnez le texte et copiez-le manuellement (Ctrl+C)");
    }
  };

  const actions = [
    { key: "regenerate", label: "Régénérer", icon: RefreshCw },
    { key: "shorten", label: "Raccourcir", icon: Scissors },
    { key: "analytical", label: "Plus analytique", icon: BrainCircuit },
    { key: "accessible", label: "Plus accessible", icon: Sparkles },
  ];

  const quality = post.quality;
  const qLow = quality && (quality.score ?? 0) < 75;

  return (
    <section
      data-testid="caption-editor"
      className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif text-lg font-bold text-forsides-ink">Caption LinkedIn</h3>
        <span className="font-mono text-xs text-slate-400">
          {(post.caption || "").length} car.
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {LENGTHS.map((l) => (
          <button
            key={l.key}
            data-testid={`length-${l.key}`}
            onClick={() => setLength(l.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              length === l.key
                ? "bg-forsides-ink text-white"
                : "bg-slate-100 text-forsides-slate hover:bg-slate-200"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="mb-3">
        <ToneSelect value={tone} onChange={setTone} compact testid="caption-tone" />
      </div>

      <textarea
        data-testid="caption-textarea"
        value={post.caption || ""}
        onChange={(e) => updateCaption(e.target.value)}
        rows={12}
        className="w-full resize-y rounded-lg border border-slate-200 bg-forsides-cream/40 p-4 font-sans text-sm leading-relaxed text-forsides-ink outline-none focus:border-forsides-red focus:ring-2 focus:ring-forsides-red/20"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.key}
            data-testid={`caption-${a.key}`}
            disabled={busy}
            onClick={() => run(a.key)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-forsides-slate transition-colors hover:border-forsides-red hover:text-forsides-red disabled:opacity-50"
          >
            {busy === a.key ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <a.icon className="h-3.5 w-3.5" />
            )}
            {a.label}
          </button>
        ))}

        <div className="relative">
          <button
            data-testid="caption-change-angle"
            disabled={busy}
            onClick={() => setAngleOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-forsides-slate transition-colors hover:border-forsides-red hover:text-forsides-red disabled:opacity-50"
          >
            <Compass className="h-3.5 w-3.5" /> Changer l'angle
          </button>
          {angleOpen && (
            <div
              data-testid="angle-menu"
              className="absolute z-20 mt-2 w-60 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
            >
              {(ed.angle_options || []).map((opt) => (
                <button
                  key={opt}
                  onClick={() => run("change_angle", opt)}
                  className="block w-full rounded-md px-3 py-1.5 text-left text-xs text-forsides-ink hover:bg-forsides-cream"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <button
          data-testid="caption-copy"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-full bg-forsides-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black"
        >
          <Copy className="h-4 w-4" /> Copier le texte
        </button>
        <button
          data-testid="caption-quality"
          disabled={busy}
          onClick={runQuality}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-forsides-slate transition-colors hover:border-forsides-red hover:text-forsides-red disabled:opacity-50"
        >
          {busy === "quality" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          Vérifier la qualité
        </button>
        {quality && (
          <span
            data-testid="quality-score"
            className="font-mono text-sm font-bold"
            style={{ color: qLow ? "#d97706" : "#059669" }}
          >
            Quality : {quality.score}/100
          </span>
        )}
      </div>

      {avoidedFound.length > 0 && (
        <div data-testid="caption-avoided" className="mt-4 rounded-lg border border-forsides-red/30 bg-forsides-red/5 p-3 text-sm text-forsides-bordeaux">
          Formule{avoidedFound.length > 1 ? "s" : ""} à éviter (style maison) : {avoidedFound.map((a) => `« ${a} »`).join(", ")}
        </div>
      )}

      {qLow && (
        <div
          data-testid="quality-alert"
          className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4"
        >
          <p className="text-sm font-semibold text-amber-800">
            Le sujet ou l'angle actuel ne présente pas encore un potentiel éditorial suffisant.
            Voici comment l'améliorer :
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {(quality.suggestions || []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
