import React from "react";
import { Link } from "react-router-dom";

const COLS = [
  { t: "Créer", links: [["Analyser un lien", "/analyze"], ["Lancer une veille", "/research"], ["Éditeur libre", "/compose"]] },
  { t: "Suivre", links: [["Mes posts", "/history"], ["Calendrier", "/calendar"], ["Style maison", "/settings"]] },
];

export const SiteFooter = () => (
  <footer className="bg-forsides-ink px-6 pb-10 pt-16 text-white lg:px-12 lg:pt-20">
    <div className="mx-auto max-w-7xl">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-5">
          <Link to="/" className="inline-flex items-center gap-4">
            <img src="/forsides-logo-dark.png" alt="FORSIDES, Solutions actuarielles" className="h-14 w-auto" />
            <span className="border-l border-white/20 pl-4 text-[10px] uppercase tracking-[0.28em] text-white/70">News Studio</span>
          </Link>
          <p className="mt-6 max-w-[28ch] font-serif text-2xl italic text-white/60">For you, by your side.</p>
          <a href="https://www.forsides.fr" target="_blank" rel="noopener noreferrer"
            className="mt-6 inline-block text-sm uppercase tracking-[0.16em] text-white hover:text-white/70">www.forsides.fr ↗</a>
        </div>
        {COLS.map((c) => (
          <div key={c.t} className="lg:col-span-2">
            <p className="text-xs uppercase tracking-[0.18em] text-white/35">{c.t}</p>
            <ul className="mt-5 space-y-3">
              {c.links.map(([l, to]) => (
                <li key={to}><Link to={to} className="text-white/60 transition-colors hover:text-white">{l}</Link></li>
              ))}
            </ul>
          </div>
        ))}
        <div className="lg:col-span-3">
          <p className="text-xs uppercase tracking-[0.18em] text-white/35">FORSIDES</p>
          <ul className="mt-5 space-y-3">
            <li><a href="https://www.forsides.fr" target="_blank" rel="noopener noreferrer" className="text-white/60 transition-colors hover:text-white">Site FORSIDES ↗</a></li>
            <li><a href="https://fr.linkedin.com/company/forsides-france" target="_blank" rel="noopener noreferrer" className="text-white/60 transition-colors hover:text-white">LinkedIn ↗</a></li>
          </ul>
        </div>
      </div>
      <div aria-hidden="true" className="mt-14 overflow-hidden text-center text-[17vw] font-black uppercase leading-[0.8] tracking-[-0.04em] text-white/[0.07]">
        Forsides
      </div>
      <div className="rule-dashed-dark mt-10 flex flex-col justify-between gap-3 pt-7 text-sm text-white/35 sm:flex-row">
        <p>© {new Date().getFullYear()} FORSIDES. Tous droits réservés.</p>
        <p>News Studio</p>
      </div>
    </div>
  </footer>
);
