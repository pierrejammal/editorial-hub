import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BrandHeader } from "@/components/BrandHeader";
import { useStudio } from "@/context/StudioContext";
import { listPosts, getPost, deletePost } from "@/lib/api";
import { scoreBand } from "@/lib/score";
import { CalendarClock, Trash2, FolderOpen, Loader2, Archive } from "lucide-react";

const History = () => {
  const nav = useNavigate();
  const { setPost } = useStudio();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    listPosts()
      .then(setPosts)
      .catch(() => toast.error("Impossible de charger les posts"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const open = async (id) => {
    try {
      const full = await getPost(id);
      setPost(full);
      nav("/studio");
    } catch (e) {
      toast.error("Impossible d'ouvrir ce post");
    }
  };

  const remove = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Supprimer définitivement ce post ?")) return;
    try {
      await deletePost(id);
      setPosts((p) => p.filter((x) => x.id !== id));
      toast.success("Post supprimé");
    } catch (err) {
      if (err.response?.status === 404) {
        setPosts((p) => p.filter((x) => x.id !== id));
        toast.success("Post déjà supprimé");
      } else {
        toast.error("Échec de la suppression, réessayez");
      }
    }
  };

  return (
    <div className="min-h-screen paper-grain">
      <BrandHeader />
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-12">
        <div className="rise flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forsides-ink text-white">
            <Archive className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-serif text-4xl font-black tracking-tight text-forsides-ink">Mes posts</h1>
            <p className="text-forsides-slate">Rouvrez, modifiez, reprogrammez ou réexportez vos publications.</p>
          </div>
        </div>

        {loading ? (
          <div className="mt-16 flex justify-center text-forsides-slate">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div data-testid="history-empty" className="mt-16 rounded-2xl border border-dashed border-slate-300 bg-white/50 p-16 text-center">
            <p className="font-serif text-xl text-forsides-ink">Aucun post enregistré</p>
            <p className="mt-1 text-sm text-forsides-slate">
              Créez un post puis cliquez sur « Enregistrer » pour le retrouver ici.
            </p>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p, i) => {
              const total = p.scoring?.total;
              const band = total != null ? scoreBand(total) : null;
              return (
                <article
                  key={p.id}
                  data-testid={`history-card-${i}`}
                  onClick={() => open(p.id)}
                  className="hover-lift group cursor-pointer overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm hover:shadow-lg"
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-forsides-cream">
                    {p.thumbnail ? (
                      <img src={p.thumbnail} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-300">
                        <FolderOpen className="h-10 w-10" />
                      </div>
                    )}
                    {band && (
                      <span
                        className="absolute left-3 top-3 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold text-white"
                        style={{ background: band.color }}
                      >
                        {total}/100
                      </span>
                    )}
                    {p.scheduled_at && (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-forsides-ink/90 px-2.5 py-1 font-mono text-[9px] font-semibold text-white">
                        <CalendarClock className="h-3 w-3" />
                        {new Date(p.scheduled_at).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                    <button
                      data-testid={`history-delete-${i}`}
                      onClick={(e) => remove(p.id, e)}
                      aria-label="Supprimer ce post"
                      title="Supprimer"
                      className="absolute bottom-3 right-3 rounded-full bg-white/90 p-2 text-forsides-red shadow transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="p-4">
                    <h3 className="line-clamp-2 font-serif text-base font-bold leading-snug text-forsides-ink">
                      {p.title}
                    </h3>
                    <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                      {p.meta?.source && <span className="truncate">{p.meta.source}</span>}
                      {p.meta?.date_label && <span>· {p.meta.date_label}</span>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default History;
