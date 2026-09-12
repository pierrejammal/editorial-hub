import React from "react";
import { Link, useLocation } from "react-router-dom";

export const BrandHeader = () => {
  const { pathname } = useLocation();
  return (
    <header
      data-testid="brand-header"
      className="sticky top-0 z-40 border-b border-slate-200/70 bg-forsides-cream/85 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" data-testid="brand-logo" className="group flex items-center gap-2.5">
          <img
            src="/forsides-logo.png"
            alt="FORSIDES"
            className="h-9 w-auto"
          />
          <span className="hidden font-mono text-[9px] uppercase tracking-[0.34em] text-forsides-slate sm:inline">
            News Studio
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/analyze"
            data-testid="nav-analyze"
            className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
              pathname === "/analyze"
                ? "bg-forsides-red text-white"
                : "text-forsides-slate hover:text-forsides-red"
            }`}
          >
            Analyser un lien
          </Link>
          <Link
            to="/research"
            data-testid="nav-research"
            className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
              pathname === "/research"
                ? "bg-forsides-red text-white"
                : "text-forsides-slate hover:text-forsides-red"
            }`}
          >
            Lancer une veille
          </Link>
          <Link
            to="/compose"
            data-testid="nav-compose"
            className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
              pathname === "/compose"
                ? "bg-forsides-red text-white"
                : "text-forsides-slate hover:text-forsides-red"
            }`}
          >
            Éditeur libre
          </Link>
        </nav>
      </div>
    </header>
  );
};
