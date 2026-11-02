import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BrandHeader } from "@/components/BrandHeader";
import { LoadingWorkflow } from "@/components/LoadingWorkflow";
import { useStudio } from "@/context/StudioContext";
import { analyzeUrl } from "@/lib/api";
import { ToneSelect } from "@/components/ToneSelect";
import { useTone } from "@/lib/tone";
import { Link2, ArrowRight, Plus, X } from "lucide-react";

const LENGTHS = [
  { key: "court", label: "Court" },
  { key: "standard", label: "Standard" },
  { key: "analytique", label: "Analytique" },
  { key: "decryptage", label: "Décryptage approfondi" },
];

const Analyze = () => {
  const nav = useNavigate();
  const { setPost } = useStudio();
  const [urls, setUrls] = useState([""]); // several links → one post that connects them
  const MAX = 4;
  const setUrlAt = (i, val) => setUrls((l) => l.map((u, j) => (j === i ? val : u)));
  const [length, setLength] = useState("standard");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(undefined);
  const [tone, setTone] = useTone();

  const submit = async (e) => {
    e.preventDefault();
    // a paste of several links in one field is split into separate links
    const list = [...new Set(urls.flatMap((u) => u.match(/https?:\/\/\S+/gi) || []).map((u) => u.trim()))].slice(0, MAX);
    const bad = urls.filter((u) => u.trim() && !/https?:\/\//i.test(u));
    if (!list.length || bad.length) {
      toast.error("Entrez des URL valides (https://…)");
      return;
    }
    setLoading(true);
    setPhase(undefined);
    try {
      const data = await analyzeUrl(list.length > 1 ? list : list[0], length, { tone, onProgress: setPhase });
      setPost(data);
      const unread = data.meta?.unreadable_links || [];
      if (unread.length) toast.warning(`${unread.length} lien(s) illisible(s), le post s'appuie sur les autres`, { description: unread.join("\n") });
      nav("/studio");
    } catch (err) {
      toast.error(err.detail || err.response?.data?.detail || "Échec de l'analyse du lien");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen paper-grain">
      <BrandHeader />
      {loading && <LoadingWorkflow mode="analyze" phase={phase} />}
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
        <div className="rise">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forsides-red/10 text-forsides-red">
            <Link2 className="h-6 w-6" />
          </div>
          <h1 className="mt-5 font-serif text-4xl font-black tracking-tight text-forsides-ink">
            Analyser une actualité
          </h1>
          <p className="mt-3 text-forsides-slate">
            Collez l'URL d'un article, d'une étude, d'un rapport ou d'une publication
            institutionnelle. La source sera analysée, scorée puis transformée en post LinkedIn.
            Ajoutez jusqu'à {MAX} liens : l'IA les croise et montre ce qui les relie (ils se complètent,
            se confirment, se contredisent…) dans un seul post.
          </p>
        </div>

        <form onSubmit={submit} className="mt-10 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <label className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
            {urls.length > 1 ? `Liens à croiser (${urls.length}/${MAX})` : "Lien de la source"}
          </label>
          <div className="mt-2 space-y-2">
            {urls.map((u, i) => (
              <div key={i} className="flex items-center gap-2">
                {urls.length > 1 && <span className="w-5 shrink-0 text-center font-mono text-xs text-slate-400">{i + 1}</span>}
                <input
                  data-testid={i === 0 ? "analyze-url-input" : `analyze-url-input-${i}`}
                  value={u}
                  onChange={(e) => setUrlAt(i, e.target.value)}
                  aria-label={`Lien ${i + 1}`}
                  placeholder={i === 0 ? "https://www.eiopa.europa.eu/..." : "https://… (autre source sur le même sujet)"}
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-forsides-red focus:ring-2 focus:ring-forsides-red/20"
                />
                {urls.length > 1 && (
                  <button type="button" aria-label={`Retirer le lien ${i + 1}`} onClick={() => setUrls((l) => l.filter((_, j) => j !== i))}
                    className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-forsides-red">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {urls.length < MAX && (
            <button type="button" data-testid="analyze-add-link" onClick={() => setUrls((l) => [...l, ""])}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-forsides-red hover:bg-forsides-red/10">
              <Plus className="h-4 w-4" /> Ajouter un lien à croiser
            </button>
          )}

          <label className="mt-6 block font-mono text-[10px] uppercase tracking-widest text-slate-400">
            Format du caption
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {LENGTHS.map((l) => (
              <button
                type="button"
                key={l.key}
                data-testid={`analyze-length-${l.key}`}
                onClick={() => setLength(l.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  length === l.key
                    ? "bg-forsides-ink text-white"
                    : "bg-slate-100 text-forsides-slate hover:bg-slate-200"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="mt-6">
            <ToneSelect value={tone} onChange={setTone} testid="analyze-tone" />
          </div>

          <button
            data-testid="analyze-submit"
            type="submit"
            disabled={loading}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-forsides-red px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-forsides-bordeaux disabled:opacity-60"
          >
            {urls.filter((u) => u.trim()).length > 1 ? `Croiser les ${urls.filter((u) => u.trim()).length} liens` : "Analyser un lien"}
            <ArrowRight className="h-5 w-5" />
          </button>
        </form>
      </main>
    </div>
  );
};

export default Analyze;
