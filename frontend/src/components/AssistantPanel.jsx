import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { askAssistant } from "@/lib/api";
import { useStudio } from "@/context/StudioContext";
import { getAssistView, emitAiChange } from "@/lib/assistBus";
import { resolveTemplate, patchTemplate, SCOPE_CHAIN } from "@/lib/visualRender";
import { Send, Loader2, Undo2, Sparkles } from "lucide-react";

// Quick requests, adapted to what the preview is showing
const SUGGESTIONS = {
  default: [
    "Raccourcis le titre du visuel",
    "Mets le chiffre clé en avant",
    "Passe en format Graphique",
    "Fais-en un carrousel",
    "Rends le texte LinkedIn plus pédagogique",
    "Corrige les fautes et la ponctuation",
  ],
  cover: ["Titre plus accrocheur", "Titre plus court", "Mets la date en avant"],
  essential: ["Résumé plus court et percutant", "Ajoute un chiffre clé de la source", "Ajoute 3 faits clés"],
  data: ["Agrandis le graphique", "Phrase sous le graphique plus courte", "Ajoute des faits chiffrés"],
  points: ["Points plus concrets", "Simplifie le vocabulaire", "Un point sur l'impact pour les assureurs"],
  takeaway: ["Message final plus fort", "Ajoute un appel à l'action"],
};

const LABELS = {
  caption: "texte LinkedIn", title_short: "titre", recommended_format: "format", chart: "graphique",
  data_points: "faits clés", key_figure_value: "chiffre clé", key_figure_label: "libellé du chiffre",
  important_date: "échéance", custom: "texte du visuel", insight_line: "phrase finale", subtitle: "sous-titre",
  hide_source_logo: "logo de la source", hide_date: "date", cta_question: "question de fin", labels: "titres de rubrique", carousel_labels: "titres de page", text_scale: "taille du texte", title_scale: "taille du titre", page_text_scale: "taille du texte de la page", extra_pages: "pages ajoutées", content_offset: "position du texte", page_blocks: "parties de la page", extra_sources: "sources", page_source: "affichage de la source", hidden: "éléments affichés", page_order: "ordre des pages", el: "taille et position des éléments", dividers: "traits de séparation", source_label: "source affichée", date_label: "date affichée", cta_text: "phrase d'appel", source_logo_scale: "taille du logo",
  fact: "L'essentiel", what_changes: "Ce qui change", why_important: "Pourquoi c'est important", insight: "À retenir",
  key_figure: "chiffre clé", angle: "angle",
  background: "couleur de fond", accent: "couleur d'accent", titles: "couleur des titres", secondary: "couleur secondaire",
  text: "couleur du texte", lines: "couleur des filets", bannerShape: "bandeau", bannerText: "texte du bandeau",
  bulletShape: "puces", ruleStyle: "filets", titleFont: "police des titres", showDate: "date", showSignature: "signature",
  signature: "signature", bannerScale: "taille du bandeau", logoScale: "taille du logo FORSIDES",
};

const STEP_TEXT = { start: "Lecture de votre demande…", ai: "L'IA prépare la modification…", finalize: "Application au visuel…" };

// Chat with the AI that edits the current post, visual and template directly (with undo).
// The conversation is kept with the post (post.chat), so it survives reloads and saves.
export const AssistantPanel = ({ post, setPost, onCaption }) => {
  const studio = useStudio() || {};
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("start");
  const [elapsed, setElapsed] = useState(0);
  const [undo, setUndo] = useState(null); // snapshot before the last AI change
  const [viewKind, setViewKind] = useState(null);
  const chat = post.chat || [];
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length, busy]);

  // seconds counter while the AI works, so it never looks frozen
  useEffect(() => {
    if (!busy) return undefined;
    const t0 = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
  }, [busy]);

  // suggestions follow the carousel page being looked at
  useEffect(() => {
    const id = setInterval(() => {
      const v = getAssistView();
      setViewKind(v.format === "K" ? v.pageKind : null);
    }, 800);
    return () => clearInterval(id);
  }, []);

  const viewTemplate = () => {
    const v = getAssistView();
    const scope = v.format === "K" ? (v.page === 0 ? "Kcover" : "Kinner") : v.format;
    const { byFormat, ...flat } = resolveTemplate(studio.template, SCOPE_CHAIN[scope] || []); // eslint-disable-line no-unused-vars
    return flat;
  };

  const send = async (text) => {
    const message = (text ?? msg).trim();
    if (!message || busy) return;
    setMsg("");
    setBusy(true);
    setStep("start");
    const history = chat.map(({ role, content }) => ({ role, content }));
    setPost((p) => ({ ...p, chat: [...(p.chat || []), { role: "user", content: message }].slice(-30) }));
    try {
      const { reply, changes = {} } = await askAssistant(post, message, history, {
        // the AI sees the template as it is on what the user is looking at (format / carousel page)
        view: getAssistView(), template: viewTemplate(), onProgress: setStep,
      });
      const keys = [
        ...(changes.caption ? ["caption"] : []),
        ...Object.keys(changes.visual || {}),
        ...Object.keys(changes.editorial || {}),
        ...Object.keys(changes.template || {}),
      ];
      const SCOPE_LABEL = { all: "tous les formats", A: "format Analyse", B: "format Data", C: "format Graphique",
        K: "tout le carrousel", Kcover: "couverture du carrousel", Kinner: "pages intérieures du carrousel" };
      const touched = keys.length > 0;
      const labels = [...new Set(keys.map((k) => LABELS[k] || k))];
      if (changes.template && changes.template_scope) labels.push(`(modèle : ${SCOPE_LABEL[changes.template_scope] || changes.template_scope})`);
      const summary = touched ? `\n\n✓ Modifié : ${labels.join(", ")}` : "\n\nAucune modification appliquée.";
      if (touched) {
        setUndo({ caption: post.caption, visual: post.visual, editorial: post.editorial,
          template: changes.template && studio.template ? studio.template : null });
      }
      if (changes.template && studio.setTemplate) {
        studio.setTemplate((t) => patchTemplate(t, changes.template_scope || "all", changes.template));
      }
      setPost((p) => ({
        ...p,
        caption: changes.caption ?? p.caption,
        visual: { ...(p.visual || {}), ...(changes.visual || {}) },
        editorial: { ...(p.editorial || {}), ...(changes.editorial || {}) },
        chat: [...(p.chat || []), { role: "assistant", content: reply + summary, changed: touched }].slice(-30),
      }));
      if (changes.caption && onCaption) onCaption(changes.caption);
      if (touched) {
        // the preview flashes, switches format if asked and jumps to the carousel page that changed
        emitAiChange({ fields: keys, labels, format: changes.visual?.recommended_format });
        if (changes.template) toast.message("Template modifié pour ce post", { description: "Enregistrez-le comme template maison dans Réglages du visuel si vous voulez le garder." });
      }
    } catch (e) {
      // say what actually went wrong, so the problem can be fixed
      const st = e.response?.status;
      const d = e.detail || (typeof e.response?.data?.detail === "string" ? e.response.data.detail : "");
      const detail = d
        || (st === 404 ? "L'assistant n'est pas encore actif sur le serveur : redémarrez le serveur (supervisorctl restart backend)."
        : st === 413 ? "La demande est trop lourde pour le serveur."
        : st === 422 ? "Le serveur n'est pas à jour : redémarrez-le (supervisorctl restart backend)."
        : st ? `Le serveur a répondu avec l'erreur ${st}. Réessayez.`
        : e.message === "Délai dépassé, réessayez." ? "L'IA a mis trop de temps à répondre, réessayez."
        : "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.");
      setPost((p) => ({ ...p, chat: [...(p.chat || []), { role: "assistant", content: detail, error: true }].slice(-30) }));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const doUndo = () => {
    if (!undo) return;
    const { template, ...rest } = undo;
    if (template && studio.setTemplate) studio.setTemplate(template);
    setPost((p) => ({ ...p, ...rest, chat: [...(p.chat || []), { role: "assistant", content: "Dernière modification annulée." }] }));
    if (onCaption && rest.caption != null) onCaption(rest.caption);
    emitAiChange({ fields: [], labels: ["modification annulée"] });
    setUndo(null);
    toast.success("Modification annulée");
  };

  const chips = (viewKind && SUGGESTIONS[viewKind]) || SUGGESTIONS.default;

  return (
    <div data-testid="assistant-panel">
      <div ref={listRef} className="max-h-80 space-y-2.5 overflow-y-auto pr-1">
        {chat.length === 0 && (
          <p className="text-sm text-forsides-slate">
            Demandez une correction en une phrase : l'IA modifie le texte, le visuel, le format ou les couleurs,
            et l'aperçu se met à jour aussitôt. Elle n'invente rien : elle s'appuie sur la source.
          </p>
        )}
        {chat.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
              m.role === "user" ? "bg-forsides-ink text-white"
                : m.error ? "bg-red-50 text-forsides-red ring-1 ring-forsides-red/20"
                : "bg-forsides-cream text-forsides-ink ring-1 ring-slate-200"}`}>
              {m.content}
            </p>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start" role="status">
            <p className="inline-flex items-center gap-2 rounded-2xl bg-forsides-cream px-3.5 py-2 text-sm text-forsides-slate ring-1 ring-slate-200">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {STEP_TEXT[step] || STEP_TEXT.ai}
              <span className="font-mono text-xs tabular-nums text-slate-400">{elapsed}s</span>
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5" data-testid="assistant-suggestions">
        {chips.map((s) => (
          <button key={s} type="button" disabled={busy} onClick={() => send(s)}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-forsides-slate transition-colors hover:bg-slate-200 disabled:opacity-50">
            <Sparkles className="h-3 w-3" /> {s}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-3 flex items-end gap-2">
        <label htmlFor="assistant-input" className="sr-only">Votre demande à l'assistant</label>
        <textarea
          id="assistant-input"
          ref={inputRef}
          data-testid="assistant-input"
          rows={2}
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ex. : mets 89,7 % en grand, fond bleu marine, raccourcis le titre"
          className="min-w-0 flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-forsides-red focus:ring-2 focus:ring-forsides-red/20"
        />
        <button type="submit" disabled={busy || !msg.trim()} data-testid="assistant-send" aria-label="Envoyer"
          className="rounded-full bg-forsides-red p-2.5 text-white transition-colors hover:bg-forsides-bordeaux disabled:opacity-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
      {undo && !busy && (
        <button type="button" onClick={doUndo} data-testid="assistant-undo"
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-forsides-slate hover:text-forsides-red">
          <Undo2 className="h-3.5 w-3.5" /> Annuler la dernière modification
        </button>
      )}
    </div>
  );
};
