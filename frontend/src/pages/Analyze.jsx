import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BrandHeader } from "@/components/BrandHeader";
import { LoadingWorkflow } from "@/components/LoadingWorkflow";
import { useStudio } from "@/context/StudioContext";
import { analyzeUrl } from "@/lib/api";
import { ToneSelect } from "@/components/ToneSelect";
import { useTone } from "@/lib/tone";
import { Link2, ArrowRight } from "lucide-react";

const LENGTHS = [
  { key: "court", label: "Court" },
  { key: "standard", label: "Standard" },
  { key: "analytique", label: "Analytique" },
  { key: "decryptage", label: "Décryptage approfondi" },
];

const Analyze = () => {
  const nav = useNavigate();
  const { setPost } = useStudio();
  const [url, setUrl] = useState("");
  const [length, setLength] = useState("standard");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(undefined);
  const [tone, setTone] = useTone();

  const submit = async (e) => {
    e.preventDefault();
    if (!/^https?:\/\//i.test(url.trim())) {
      toast.error("Entrez une URL valide (https://…)");
      return;
    }
    setLoading(true);
    setPhase(undefined);
    try {
      const data = await analyzeUrl(url.trim(), length, { tone, onProgress: setPhase });
      setPost(data);
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
          </p>
        </div>

        <form onSubmit={submit} className="mt-10 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <label className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
            Lien de la source
          </label>
          <input
            data-testid="analyze-url-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.eiopa.europa.eu/..."
            className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-forsides-red focus:ring-2 focus:ring-forsides-red/20"
          />

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
            Analyser un lien
            <ArrowRight className="h-5 w-5" />
          </button>
        </form>
      </main>
    </div>
  );
};

export default Analyze;
