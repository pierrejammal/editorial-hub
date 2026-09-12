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
            complet — caption et visuel — cohérent avec l'identité FORSIDES.
          </p>
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
          <div className="mb-6 font-mono text-[10px] uppercase tracking-[0.24em] text-slate-400">
            La chaîne éditoriale
          </div>
          <WorkflowStepper active={7} />
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-forsides-slate">
            Recherche · Collecte · Filtrage · Déduplication · Scoring · Triage · Sélection · Analyse
            éditoriale · Choix de l'angle · Génération · Contrôle qualité · Visuel. Chaque
            publication doit donner l'impression qu'un professionnel de la veille a travaillé dessus.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Home;
