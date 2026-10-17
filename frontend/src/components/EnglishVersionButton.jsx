import React, { useState } from "react";
import { toast } from "sonner";
import { savePost, translatePost } from "@/lib/api";
import { buildSavePayload } from "@/lib/postPayload";
import { translationPayload, mergeTranslation } from "@/lib/english";
import { Languages, Loader2 } from "lucide-react";

// Saves the French post (so it isn't lost), then opens its English translation as a new post.
export const EnglishVersionButton = ({ post, setPost, thumb }) => {
  const [busy, setBusy] = useState(false);
  if (post.meta?.lang === "en") return null;

  const run = async () => {
    setBusy(true);
    try {
      const { id: frenchId } = await savePost(buildSavePayload(post, { thumb, scheduled_at: post.scheduled_at }));
      const tr = await translatePost(translationPayload(post));
      setPost(mergeTranslation({ ...post, id: frenchId }, tr, frenchId));
      toast.success("Version anglaise créée. La version française est enregistrée dans Mes posts.");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Échec de la traduction, réessayez");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      data-testid="english-version"
      onClick={run}
      disabled={busy}
      title="Traduire le texte et le visuel en anglais (nouvelle version)"
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-forsides-ink transition-colors hover:border-forsides-red hover:text-forsides-red disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
      {busy ? "Traduction…" : "Version anglaise"}
    </button>
  );
};
