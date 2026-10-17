import React, { useState } from "react";
import { toast } from "sonner";
import { savePost } from "@/lib/api";
import { Save, CalendarClock, Loader2, X } from "lucide-react";

export const PostActions = ({ post, thumb, origin = "studio", onSaved }) => {
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState("");

  // datetime-local wants local time "YYYY-MM-DDTHH:mm"; refuse dates in the past
  const now = new Date();
  const minWhen = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const isPast = !!when && new Date(when) <= now;

  const build = (scheduled_at) => ({
    id: post.id || null,
    title: post.visual?.title_short || post.meta?.topic || "Post FORSIDES",
    caption: post.caption || "",
    thumbnail: thumb || "",
    meta: post.meta || {},
    scoring: post.scoring || null,
    editorial: post.editorial || null,
    visual: post.visual || null,
    quality: post.quality || null,
    sources: post.sources || null,
    scheduled_at: scheduled_at || null,
    origin,
  });

  const doSave = async (scheduled_at) => {
    setSaving(true);
    try {
      const { id } = await savePost(build(scheduled_at));
      onSaved?.(id);
      if (scheduled_at) {
        const d = new Date(scheduled_at);
        toast.success(`Programmé pour le ${d.toLocaleString("fr-FR")} — simulation (LinkedIn non connecté)`);
        setOpen(false);
      } else {
        toast.success("Post enregistré dans Mes posts");
      }
    } catch (e) {
      toast.error("Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        data-testid="post-save"
        onClick={() => doSave(null)}
        disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-forsides-ink transition-colors hover:border-forsides-red hover:text-forsides-red disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
      </button>
      <button
        data-testid="post-schedule-open"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-forsides-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-forsides-bordeaux"
      >
        <CalendarClock className="h-4 w-4" /> Programmer
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div
            data-testid="schedule-dialog"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-xl font-bold text-forsides-ink">Programmer la publication</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-forsides-red">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-forsides-slate">
              Choisissez la date et l'heure de publication sur LinkedIn.
            </p>
            <input
              data-testid="schedule-datetime"
              type="datetime-local"
              min={minWhen}
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-forsides-red focus:ring-2 focus:ring-forsides-red/20"
            />
            {isPast && (
              <p className="mt-2 text-xs font-medium text-forsides-red">
                Choisissez une date et une heure dans le futur.
              </p>
            )}
            <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              Simulation : la connexion directe à LinkedIn n'est pas activée. La publication programmée
              est enregistrée dans « Mes posts » avec son horaire.
            </div>
            <button
              data-testid="schedule-confirm"
              disabled={!when || saving || isPast}
              onClick={() => doSave(new Date(when).toISOString())}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-forsides-red px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-forsides-bordeaux disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
              Programmer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
