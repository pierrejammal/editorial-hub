import React from "react";
import { useNavigate } from "react-router-dom";
import { BrandHeader } from "@/components/BrandHeader";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import { Link2, Search, ArrowRight, PenLine } from "lucide-react";

const Home = () => {
  const nav = useNavigate();
  return (
    <div className="min-h-screen paper-grain">
      <BrandHeader />
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.5fr_1fr]">
          <div className="max-w-3xl rise">
            <span className="news-flag inline-block rounded-sm px-3 py-1 text-xl">NEWS</span>
            <h1 className="mt-6 font-serif text-4xl font-black leading-[1.05] tracking-tight text-forsides-ink sm:text-5xl lg:text-6xl">
              Forsides News Studio
            </h1>
            <p className="mt-4 font-serif text-xl italic text-forsides-slate sm:text-2xl">
              De la veille à la publication LinkedIn.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-forsides-slate">
              Une chaîne éditoriale professionnelle qui sélectionne les meilleurs sujets de
              l'assurance et de l'actuariat, trouve le meilleur angle, et produit un post LinkedIn
              complet (caption et visuel) cohérent avec l'identité FORSIDES.
            </p>
          </div>

          <div className="rise hidden justify-center lg:flex" style={{ animationDelay: "160ms" }}>
            <div className="w-full max-w-[300px] rotate-2 rounded-xl border border-slate-200/80 bg-[#F7E8E4] p-5 shadow-2xl transition-transform hover:rotate-0" style={{ aspectRatio: "4/5" }}>
              <div className="flex items-start justify-between">
                <span className="news-flag rounded-[3px] px-2.5 py-1 text-2xl shadow-md">NEWS</span>
                <span className="mt-1 font-sans text-[11px] font-extrabold tracking-[0.12em] text-forsides-ink">
                  FORSIDES
                </span>
              </div>
              <div className="mt-1 font-mono text-[9px] tracking-[0.2em] text-forsides-ink/70">
                SEPTEMBRE 2026
              </div>
              <div className="mt-5 space-y-1.5">
                <div className="h-3 w-full rounded-sm bg-forsides-bordeaux/85" />
                <div className="h-3 w-5/6 rounded-sm bg-forsides-bordeaux/85" />
                <div className="h-3 w-2/3 rounded-sm bg-forsides-bordeaux/85" />
              </div>
              <div className="mt-4 h-[3px] w-10 bg-forsides-red" />
              <div className="mt-3 space-y-1">
                <div className="h-1.5 w-full rounded-sm bg-forsides-ink/40" />
                <div className="h-1.5 w-11/12 rounded-sm bg-forsides-ink/40" />
                <div className="h-1.5 w-4/5 rounded-sm bg-forsides-ink/40" />
              </div>
              <div className="mt-4 space-y-2.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`mt-0.5 h-2 w-2 shrink-0 ${i % 2 === 0 ? "bg-forsides-red" : "bg-[#E7A390]"}`} />
                    <div className="flex-1 space-y-1">
                      <div className="h-1 w-1/3 rounded-sm bg-forsides-ink/30" />
                      <div className={`h-1.5 rounded-sm bg-forsides-bordeaux/70 ${i === 1 ? "w-3/4" : "w-11/12"}`} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="h-px flex-1 bg-forsides-bordeaux/50" />
                <span className="font-mono text-[9px] italic text-forsides-bordeaux">for you, by your side</span>
                <span className="h-px flex-1 bg-forsides-bordeaux/50" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <button
            data-testid="home-card-analyze"
            onClick={() => nav("/analyze")}
            className="hover-lift group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-8 text-left shadow-sm hover:border-forsides-red/40 hover:shadow-xl"
            style={{ animationDelay: "120ms" }}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-forsides-red/10 text-forsides-red transition-colors group-hover:bg-forsides-red group-hover:text-white">
              <Link2 className="h-7 w-7" />
            </div>
            <h2 className="mt-6 font-serif text-2xl font-bold text-forsides-ink">
              🔗 Analyser une actualité
            </h2>
            <p className="mt-2 text-forsides-slate">
              Collez un lien et transformez-le en contenu LinkedIn.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 font-semibold text-forsides-red">
              Analyser un lien
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>

          <button
            data-testid="home-card-research"
            onClick={() => nav("/research")}
            className="hover-lift group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-forsides-ink p-8 text-left shadow-sm hover:shadow-xl"
            style={{ animationDelay: "200ms" }}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-white transition-colors group-hover:bg-forsides-red">
              <Search className="h-7 w-7" />
            </div>
            <h2 className="mt-6 font-serif text-2xl font-bold text-white">🔎 Explorer un sujet</h2>
            <p className="mt-2 text-slate-300">
              Recherchez, scorez et sélectionnez les actualités les plus pertinentes.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 font-semibold text-white">
              Lancer une veille
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>

          <button
            data-testid="home-card-compose"
            onClick={() => nav("/compose")}
            className="hover-lift group relative flex items-center justify-between gap-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-8 text-left shadow-sm hover:border-forsides-red/40 hover:shadow-xl lg:col-span-2"
            style={{ animationDelay: "280ms" }}
          >
            <div className="flex items-center gap-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-forsides-ink/5 text-forsides-ink transition-colors group-hover:bg-forsides-red group-hover:text-white">
                <PenLine className="h-7 w-7" />
              </div>
              <div>
                <h2 className="font-serif text-2xl font-bold text-forsides-ink">
                  ✍️ Éditeur libre
                </h2>
                <p className="mt-1 text-forsides-slate">
                  Vous avez déjà votre texte ? Composez le visuel FORSIDES en direct, à côté.
                </p>
              </div>
            </div>
            <span className="hidden shrink-0 items-center gap-2 font-semibold text-forsides-red sm:inline-flex">
              Composer
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </div>

        <div className="mt-16 rounded-2xl border border-slate-200/80 bg-white/60 p-8">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <div className="mb-6 font-mono text-[10px] uppercase tracking-[0.24em] text-slate-400">
                La chaîne éditoriale
              </div>
              <WorkflowStepper active={7} />
              <p className="mt-6 max-w-3xl text-sm leading-relaxed text-forsides-slate">
                Recherche · Collecte · Filtrage · Déduplication · Scoring · Triage · Sélection ·
                Analyse éditoriale · Choix de l'angle · Génération · Contrôle qualité · Visuel.
                Chaque publication doit donner l'impression qu'un professionnel de la veille a
                travaillé dessus.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 lg:border-l lg:border-slate-200 lg:pl-10">
              {[
                { n: "/100", l: "Score éditorial" },
                { n: "5–6", l: "Sujets triés" },
                { n: "4:5", l: "Visuel 1200×1500" },
              ].map((s) => (
                <div key={s.l} className="flex flex-col items-start justify-center rounded-xl bg-forsides-cream p-4">
                  <span className="font-serif text-2xl font-black text-forsides-red">{s.n}</span>
                  <span className="mt-1 text-xs leading-tight text-forsides-slate">{s.l}</span>
                </div>
              ))}
              <div className="col-span-3 mt-1 flex items-center gap-3 rounded-xl bg-forsides-ink p-4">
                <span className="news-flag rounded-sm px-2 py-0.5 text-sm">NEWS</span>
                <span className="text-sm font-medium text-white">
                  Identité FORSIDES appliquée automatiquement à chaque visuel.
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
