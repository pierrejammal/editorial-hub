import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { askAssistant } from "@/lib/api";
import { Send, Loader2, Undo2, Sparkles } from "lucide-react";

const SUGGESTIONS = [
  "Raccourcis le titre du visuel",
  "Mets le chiffre clé en avant (format Data)",
  "Passe en format Graphique",
  "Rends le texte LinkedIn plus pédagogique",
  "Corrige les fautes et la ponctuation",
];

// Chat with the AI that edits the current post and visual directly (with undo).
// The conversation is kept with the post (post.chat), so it survives reloads and saves.
export const AssistantPanel = ({ post, setPost, onCaption }) => {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState(null); // snapshot before the last AI change
  const chat = post.chat || [];
  const listRef = useRef(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length, busy]);

  const send = async (text) => {
    const message = (text ?? msg).trim();
    if (!message || busy) return;
    setMsg("");
    setBusy(true);
    const history = chat.map(({ role, content }) => ({ role, content }));
    setPost((p) => ({ ...p, chat: [...(p.chat || []), { role: "user", content: message }].slice(-30) }));
    try {
      const { reply, changes = {} } = await askAssistant(post, message, history);
      const touched = Object.keys(changes).length > 0;
      if (touched) setUndo({ caption: post.caption, visual: post.visual, editorial: post.editorial });
      setPost((p) => ({
        ...p,
        caption: changes.caption ?? p.caption,
        visual: { ...(p.visual || {}), ...(changes.visual || {}) },
        editorial: { ...(p.editorial || {}), ...(changes.editorial || {}) },
        chat: [...(p.chat || []), { role: "assistant", content: reply, changed: touched }].slice(-30),
      }));
      if (changes.caption && onCaption) onCaption(changes.caption);
    } catch (e) {
      const detail = e.detail || e.response?.data?.detail || "L'assistant n'a pas pu répondre, réessayez.";
      setPost((p) => ({ ...p, chat: [...(p.chat || []), { role: "assistant", content: detail, error: true }].slice(-30) }));
    } finally {
      setBusy(false);
    }
  };

  const doUndo = () => {
    if (!undo) return;
    setPost((p) => ({ ...p, ...undo, chat: [...(p.chat || []), { role: "assistant", content: "Dernière modification annulée." }] }));
    if (onCaption && undo.caption != null) onCaption(undo.caption);
    setUndo(null);
    toast.success("Modification annulée");
  };

  return (
    <div data-testid="assistant-panel">
      <div ref={listRef} className="max-h-80 space-y-2.5 overflow-y-auto pr-1">
        {chat.length === 0 && (
          <p className="text-sm text-forsides-slate">
            Demandez une correction en une phrase : l'IA modifie le texte et le visuel directement, sans rien inventer
            (elle s'appuie sur la source).
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
          <div className="flex justify-start">
            <p className="inline-flex items-center gap-2 rounded-2xl bg-forsides-cream px-3.5 py-2 text-sm text-forsides-slate ring-1 ring-slate-200">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Modification en cours…
            </p>
          </div>
        )}
      </div>

      {chat.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" disabled={busy} onClick={() => send(s)}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-forsides-slate transition-colors hover:bg-slate-200 disabled:opacity-50">
              <Sparkles className="h-3 w-3" /> {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-3 flex items-end gap-2">
        <label htmlFor="assistant-input" className="sr-only">Votre demande à l'assistant</label>
        <textarea
          id="assistant-input"
          data-testid="assistant-input"
          rows={2}
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ex. : mets 89,7 % en grand et raccourcis le titre"
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
