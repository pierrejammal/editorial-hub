import React, { useState } from "react";
import { toast } from "sonner";
import { savePost, translatePost, getPost } from "@/lib/api";
import { buildSavePayload } from "@/lib/postPayload";
import { translationPayload, mergeTranslation } from "@/lib/english";
import { Languages, Loader2 } from "lucide-react";

// FR ⇄ EN switch. The current version is always saved before switching, so nothing is lost,
// and the two versions are linked so the translation is only done once.
export const EnglishVersionButton = ({ post, setPost, thumb }) => {
  const [busy, setBusy] = useState(false);
  const isEnglish = post.meta?.lang === "en";
  if (isEnglish && !post.translated_from) return null; // English post with no French original

  const saveCurrent = async () => {
    const { id } = await savePost(buildSavePayload(post, { thumb, scheduled_at: post.scheduled_at }));
    return id;
  };

  const toFrench = async () => {
    const enId = await saveCurrent();
    const fr = await getPost(post.translated_from);
    const linked = { ...fr, english_id: enId };
    await savePost(buildSavePayload(linked, { thumb: fr.thumbnail, scheduled_at: fr.scheduled_at }));
    setPost(linked);
    toast.success("Version française. La version anglaise est enregistrée dans Mes posts.");
  };

  const toEnglish = async () => {
    const frId = await saveCurrent();
    if (post.english_id) {
      try {
        const en = await getPost(post.english_id);
        setPost({ ...en, translated_from: frId });
        toast.success("Version anglaise (déjà traduite). La version française est enregistrée.");
        return;
      } catch {
        // English version was deleted: translate again below
      }
    }
    const tr = await translatePost(translationPayload(post));
    const en = { ...mergeTranslation({ ...post, id: frId }, tr, frId), english_id: null, scheduled_at: null };
    // save the English version right away and link it to the French one (no second translation later)
    const { id: enId } = await savePost(buildSavePayload(en, { thumb: "" }));
    await savePost(buildSavePayload({ ...post, id: frId, english_id: enId }, { thumb, scheduled_at: post.scheduled_at }));
    setPost({ ...en, id: enId });
    toast.success("Version anglaise créée et enregistrée. La version française reste dans Mes posts.");
  };

  const run = async () => {
    setBusy(true);
    try {
      await (isEnglish ? toFrench() : toEnglish());
    } catch (e) {
      toast.error(e.response?.data?.detail || (isEnglish ? "Impossible d'ouvrir la version française" : "Échec de la traduction, réessayez"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      data-testid={isEnglish ? "french-version" : "english-version"}
      onClick={run}
      disabled={busy}
      title={isEnglish ? "Revenir à la version française" : "Traduire le texte et le visuel en anglais"}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-forsides-ink transition-colors hover:border-forsides-red hover:text-forsides-red disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
      {busy ? (isEnglish ? "Ouverture…" : "Traduction…") : isEnglish ? "Version française" : "Version anglaise"}
    </button>
  );
};
