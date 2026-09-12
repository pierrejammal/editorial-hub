import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BrandHeader } from "@/components/BrandHeader";
import { LoadingWorkflow } from "@/components/LoadingWorkflow";
import { TopicCard } from "@/components/TopicCard";
import { useStudio } from "@/context/StudioContext";
import { searchTopics, analyzeTopic } from "@/lib/api";
import { Search, RotateCcw, SlidersHorizontal } from "lucide-react";

const EXAMPLES = [
  "Actualités Solvabilité II",
  "Publications EIOPA",
  "IFRS 17",
  "Réformes de l'assurance",
  "Santé et Prévoyance",
  "Protection sociale",
];

const Research = () => {
  const nav = useNavigate();
  const { research, setResearch, setPost } = useStudio();
  const [topic, setTopic] = useState(research.params?.topic || "");
  const [period, setPeriod] = useState(research.params?.period || "3 dernières semaines");
  const [country, setCountry] = useState(research.params?.country || "France / Europe");
  const [institutions, setInstitutions] = useState(research.params?.institutions || "");
  const [maxResults, setMaxResults] = useState(research.params?.max_results || 6);
  const [showAdv, setShowAdv] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const doSearch = async (exclude = []) => {
    if (!topic.trim()) {
      toast.error("Saisissez un sujet ou une instruction");
      return;
    }
    setLoading(true);
    const params = {
      topic: topic.trim(),
      period,
      country,
      institutions,
      max_results: Number(maxResults),
    };
    try {
      const data = await searchTopics({ ...params, exclude });
      setResearch({
        params,
        topics: data.topics || [],
        excluded: [...exclude, ...(data.topics || []).map((t) => t.title)],
        candidatesCount: data.candidates_count || 0,
      });
      if (exclude.length)
        toast.success("Nouvelle sélection générée — sujets précédents exclus");
    } catch (err) {
      toast.error(err.detail || err.response?.data?.detail || "Échec de la recherche");
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => doSearch(research.excluded);

  const ignore = (t) => {
    setResearch((r) => ({
      ...r,
      topics: r.topics.filter((x) => x.id !== t.id),
      excluded: [...r.excluded, t.title],
    }));
  };

  const generate = async (t) => {
    setGenerating(true);
    try {
      const data = await analyzeTopic(t, "standard");
      setPost(data);
      nav("/studio");
    } catch (err) {
      toast.error(err.detail || err.response?.data?.detail || "Échec de la génération");
    } finally {
      setGenerating(false);
    }
  };

  const topics = research.topics || [];

  return (
    <div className="min-h-screen paper-grain">
      <BrandHeader />
      {(loading || generating) && (
        <LoadingWorkflow label={generating ? "Production éditoriale" : "Veille en cours"} />
      )}
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-16">
        <div className="rise">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forsides-ink text-white">
            <Search className="h-6 w-6" />
          </div>
          <h1 className="mt-5 font-serif text-4xl font-black tracking-tight text-forsides-ink">
            Explorer un sujet
          </h1>
          <p className="mt-3 text-forsides-slate">
            Constituez un vivier de 15 à 30 sources, dédupliquez, filtrez et scorez. Seuls les 5 à 6
            meilleurs sujets sont présentés.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <label className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
            Sujet ou instruction
          </label>
          <input
            data-testid="research-topic-input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch([])}
            placeholder="ex : Nouveautés réglementaires assurance vie"
            className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm outline-none focus:border-forsides-red focus:ring-2 focus:ring-forsides-red/20"
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                data-testid={`example-${ex.slice(0, 6)}`}
                onClick={() => setTopic(ex)}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs text-forsides-slate transition-colors hover:bg-forsides-red hover:text-white"
              >
                {ex}
              </button>
            ))}
          </div>

          <button
            data-testid="toggle-advanced"
            onClick={() => setShowAdv((s) => !s)}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-forsides-slate hover:text-forsides-red"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Préciser la recherche
          </button>

          {showAdv && (
            <div className="mt-3 grid gap-4 rounded-lg bg-forsides-cream p-4 sm:grid-cols-2">
              <Field label="Période" testid="field-period" value={period} onChange={setPeriod} />
              <Field label="Pays / zone" testid="field-country" value={country} onChange={setCountry} />
              <Field
                label="Institutions prioritaires"
                testid="field-institutions"
                value={institutions}
                onChange={setInstitutions}
                placeholder="EIOPA, ACPR, DREES…"
              />
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
                  Nombre de résultats
                </label>
                <input
                  data-testid="field-max"
                  type="number"
                  min={3}
                  max={6}
                  value={maxResults}
                  onChange={(e) => setMaxResults(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-forsides-red"
                />
              </div>
            </div>
          )}

          <button
            data-testid="research-submit"
            onClick={() => doSearch([])}
            disabled={loading}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-forsides-ink px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
          >
            <Search className="h-5 w-5" /> Lancer une veille
          </button>
        </div>

        {topics.length > 0 && (
          <div className="mt-12">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl font-bold text-forsides-ink">
                  Sélection éditoriale
                </h2>
                <p className="text-sm text-forsides-slate">
                  {topics.length} sujets retenus sur {research.candidatesCount} sources analysées
                </p>
              </div>
              <button
                data-testid="refresh-selection"
                onClick={refresh}
                className="inline-flex items-center gap-1.5 rounded-full border border-forsides-red px-4 py-2 text-sm font-semibold text-forsides-red transition-colors hover:bg-forsides-red hover:text-white"
              >
                <RotateCcw className="h-4 w-4" /> Rafraîchir la sélection
              </button>
            </div>
            <div className="space-y-4">
              {topics.map((t, i) => (
                <TopicCard
                  key={t.id}
                  topic={t}
                  index={i}
                  onGenerate={generate}
                  onIgnore={ignore}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const Field = ({ label, value, onChange, placeholder, testid }) => (
  <div>
    <label className="font-mono text-[10px] uppercase tracking-widest text-slate-400">{label}</label>
    <input
      data-testid={testid}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-forsides-red"
    />
  </div>
);

export default Research;
