import React, { useState } from "react";
import { toast } from "sonner";
import { useStudio } from "@/context/StudioContext";
import { saveTemplate } from "@/lib/api";
import { DEFAULT_TEMPLATE } from "@/lib/visualRender";
import { Palette, ChevronDown, Save, RotateCcw, Loader2 } from "lucide-react";

const COLORS = [
  { key: "background", label: "Fond" },
  { key: "accent", label: "Bandeau et puces" },
  { key: "titles", label: "Titres" },
  { key: "secondary", label: "Couleur secondaire" },
  { key: "text", label: "Texte" },
  { key: "lines", label: "Filets" },
];
const PRESETS = [
  { name: "FORSIDES", t: {} },
  { name: "Marine", t: { background: "#EEF2F7", accent: "#1F3A5F", titles: "#14263F", secondary: "#8FA9C8", text: "#1b1b1b", lines: "#C9D6E6" } },
  { name: "Sauge", t: { background: "#EEF3EE", accent: "#3F6B4F", titles: "#24412F", secondary: "#9DBFA6", text: "#1b1b1b", lines: "#C8DACC" } },
  { name: "Sobre", t: { background: "#FFFFFF", accent: "#1b1b1b", titles: "#1b1b1b", secondary: "#9AA0A6", text: "#1b1b1b", lines: "#E2E4E8" } },
];

const Choice = ({ value, options, onChange, testid }) => (
  <div className="flex flex-wrap gap-1.5" data-testid={testid}>
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          value === o.value ? "bg-forsides-ink text-white" : "bg-slate-100 text-forsides-slate hover:bg-slate-200"
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);
const Label = ({ children }) => (
  <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-400">{children}</p>
);

// Live editing of the visual template: every change redraws the preview immediately.
// "Enregistrer comme modèle maison" stores it on the server for every post and every user.
export const TemplateEditor = () => {
  const { template, setTemplate, savedTemplate, setSavedTemplate } = useStudio();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (patch) => setTemplate((t) => ({ ...t, ...patch }));
  const dirty = JSON.stringify(template) !== JSON.stringify(savedTemplate);

  const save = async () => {
    setSaving(true);
    try {
      const stored = await saveTemplate(template);
      const merged = { ...DEFAULT_TEMPLATE, ...stored };
      setSavedTemplate(merged);
      setTemplate(merged);
      toast.success("Modèle maison enregistré : il s'applique à tous les visuels et carrousels");
    } catch {
      toast.error("Échec de l'enregistrement du modèle");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200">
      <button
        type="button"
        data-testid="template-toggle"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-forsides-ink hover:text-forsides-red"
      >
        <span className="inline-flex items-center gap-2">
          <Palette className="h-4 w-4" /> Personnaliser le modèle
          {dirty && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">non enregistré</span>}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div data-testid="template-editor" className="space-y-4 px-3 pb-4">
          <p className="text-xs text-slate-500">Chaque changement s'affiche en direct sur le visuel.</p>

          <div>
            <Label>Palettes</Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const t = { ...DEFAULT_TEMPLATE, ...p.t };
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => set({ ...DEFAULT_TEMPLATE, ...p.t, bannerText: template.bannerText, signature: template.signature })}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-forsides-ink hover:border-forsides-red"
                  >
                    <span className="flex">
                      {[t.background, t.accent, t.titles].map((c) => (
                        <span key={c} className="-ml-1 h-3.5 w-3.5 rounded-full border border-white first:ml-0" style={{ background: c }} />
                      ))}
                    </span>
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Couleurs</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {COLORS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2 py-1.5 text-xs text-forsides-ink">
                  <input
                    type="color"
                    data-testid={`template-color-${c.key}`}
                    value={template[c.key]}
                    onChange={(e) => set({ [c.key]: e.target.value })}
                    className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Mot du bandeau</Label>
              <input
                data-testid="template-banner-text"
                value={template.bannerText}
                maxLength={24}
                onChange={(e) => set({ bannerText: e.target.value.toUpperCase() })}
                placeholder="NEWS, VEILLE, ACTU… (vide = pas de bandeau)"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-forsides-red"
              />
            </div>
            <div>
              <Label>Signature</Label>
              <input
                data-testid="template-signature"
                value={template.signature}
                maxLength={60}
                onChange={(e) => set({ signature: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-forsides-red"
              />
            </div>
          </div>

          <div>
            <Label>Forme du bandeau</Label>
            <Choice testid="template-banner-shape" value={template.bannerShape} onChange={(v) => set({ bannerShape: v })}
              options={[{ value: "rect", label: "Rectangle" }, { value: "rounded", label: "Arrondi" }, { value: "pill", label: "Pastille" }, { value: "underline", label: "Souligné" }]} />
          </div>
          <div>
            <Label>Puces</Label>
            <Choice testid="template-bullets" value={template.bulletShape} onChange={(v) => set({ bulletShape: v })}
              options={[{ value: "square", label: "■ Carrées" }, { value: "circle", label: "● Rondes" }, { value: "dash", label: "— Tirets" }]} />
          </div>
          <div>
            <Label>Filet sous le titre</Label>
            <Choice testid="template-rule" value={template.ruleStyle} onChange={(v) => set({ ruleStyle: v })}
              options={[{ value: "bar", label: "Barre + filet" }, { value: "thin", label: "Filet fin" }, { value: "none", label: "Aucun" }]} />
          </div>
          <div>
            <Label>Police des titres</Label>
            <Choice testid="template-font" value={template.titleFont} onChange={(v) => set({ titleFont: v })}
              options={[{ value: "Outfit", label: "Moderne (Outfit)" }, { value: "Playfair Display", label: "Éditoriale (Playfair)" }]} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-forsides-ink">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={template.showDate} onChange={(e) => set({ showDate: e.target.checked })} /> Afficher la date
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={template.showSignature} onChange={(e) => set({ showSignature: e.target.checked })} /> Afficher la signature
            </label>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              data-testid="template-save"
              onClick={save}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 rounded-full bg-forsides-red px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-forsides-bordeaux disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Enregistrer comme modèle maison
            </button>
            {dirty && (
              <button type="button" onClick={() => setTemplate(savedTemplate)}
                className="rounded-full px-3 py-2 text-xs font-medium text-forsides-slate hover:text-forsides-red">
                Annuler les changements
              </button>
            )}
            <button type="button" data-testid="template-reset" onClick={() => setTemplate(DEFAULT_TEMPLATE)}
              className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-medium text-forsides-slate hover:text-forsides-red">
              <RotateCcw className="h-3.5 w-3.5" /> Modèle FORSIDES d'origine
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
