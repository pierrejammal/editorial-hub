import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { BrandHeader } from "@/components/BrandHeader";
import { getStyle, saveStyle } from "@/lib/api";
import { TONES } from "@/lib/tone";
import { Settings2, Loader2, Save } from "lucide-react";

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-forsides-red focus:ring-2 focus:ring-forsides-red/20";
const Label = ({ children, hint }) => (
  <div>
    <label className="font-mono text-[10px] uppercase tracking-widest text-slate-400">{children}</label>
    {hint && <p className="text-xs text-slate-500">{hint}</p>}
  </div>
);

// "Style maison": rules saved once on the server and applied to every text the AI writes.
const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tone, setTone] = useState("standard");
  const [avoid, setAvoid] = useState("");
  const [signature, setSignature] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [instructions, setInstructions] = useState("");

  useEffect(() => {
    getStyle()
      .then((s) => {
        setTone(s.tone || "standard");
        setAvoid((s.avoid || []).join("\n"));
        setSignature(s.signature || "");
        setHashtags((s.hashtags || []).join(" "));
        setInstructions(s.instructions || "");
      })
      .catch(() => toast.error("Impossible de charger le style maison"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await saveStyle({
        tone,
        avoid: avoid.split("\n").map((x) => x.trim()).filter(Boolean),
        signature: signature.trim(),
        hashtags: hashtags.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean)
          .map((h) => (h.startsWith("#") ? h : `#${h}`)),
        instructions: instructions.trim(),
      });
      toast.success("Style maison enregistré : il s'applique aux prochains posts");
    } catch {
      toast.error("Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen paper-grain">
      <BrandHeader />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-12 sm:px-6">
        <div className="rise flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forsides-ink text-white">
            <Settings2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-serif text-4xl font-black tracking-tight text-forsides-ink">Style maison</h1>
            <p className="text-forsides-slate">Enregistré une fois, appliqué à tous les textes rédigés par l'IA.</p>
          </div>
        </div>

        {loading ? (
          <div className="mt-16 flex justify-center text-forsides-slate"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <Label hint="Utilisé quand vous ne choisissez pas de ton au moment de générer.">Ton par défaut</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {TONES.filter((t) => t.key).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    data-testid={`settings-tone-${t.key}`}
                    onClick={() => setTone(t.key)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      tone === t.key ? "border-forsides-red bg-forsides-red/5" : "border-slate-200 hover:border-forsides-red/50"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-forsides-ink">{t.label}</span>
                    <span className="block text-xs text-slate-500">{t.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label hint="Une formule par ligne. S'ajoutent aux formules déjà interdites (« Dans un monde en constante évolution »…).">
                Formules à éviter
              </Label>
              <textarea data-testid="settings-avoid" rows={5} value={avoid} onChange={(e) => setAvoid(e.target.value)}
                placeholder={"Nous sommes ravis de\nGame changer\nN'hésitez pas à"} className={`${inputCls} resize-y`} />
            </div>

            <div>
              <Label hint="Ajoutée automatiquement à la fin de chaque post, avant les hashtags. Laissez vide pour aucune signature.">
                Signature
              </Label>
              <input data-testid="settings-signature" value={signature} onChange={(e) => setSignature(e.target.value)}
                placeholder="— L'équipe FORSIDES, actuariat conseil" className={inputCls} />
            </div>

            <div>
              <Label hint="L'IA en choisit 2 ou 3 parmi ceux-ci quand ils sont pertinents.">Hashtags préférés</Label>
              <input data-testid="settings-hashtags" value={hashtags} onChange={(e) => setHashtags(e.target.value)}
                placeholder="#Actuariat #Assurance #Prévoyance #SolvabilitéII" className={inputCls} />
            </div>

            <div>
              <Label hint="Toute autre règle : vouvoiement, mentions à faire, sujets sensibles, etc.">Consignes maison</Label>
              <textarea data-testid="settings-instructions" rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)}
                placeholder="Toujours vouvoyer. Citer la source dans le premier paragraphe. Ne jamais commenter un acteur en particulier."
                className={`${inputCls} resize-y`} />
            </div>

            <button data-testid="settings-save" onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-forsides-red px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-forsides-bordeaux disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer le style maison
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Settings;
