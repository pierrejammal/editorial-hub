import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Settings2, FilePen } from "lucide-react";
import { useStudio } from "@/context/StudioContext";

const LINKS = [
  { to: "/analyze", label: "Analyser un lien", testid: "nav-analyze" },
  { to: "/research", label: "Lancer une veille", testid: "nav-research" },
  { to: "/compose", label: "Éditeur libre", testid: "nav-compose" },
  { to: "/history", label: "Mes posts", testid: "nav-history" },
  { to: "/calendar", label: "Calendrier", testid: "nav-calendar" },
];

export const BrandHeader = () => {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const { post } = useStudio() || {};
  // way back to the post being edited, from any page
  const current = post && pathname !== "/studio" ? (post.visual?.title_short || post.meta?.topic || "Post en cours") : null;

  useEffect(() => setOpen(false), [pathname]); // close the mobile menu after navigating

  const linkCls = (to, mobile) =>
    `${mobile ? "block rounded-lg px-4 py-3 text-base" : "rounded-full px-4 py-1.5"} font-medium transition-colors ${
      pathname === to ? "bg-forsides-red text-white" : "text-forsides-slate hover:text-forsides-red"
    }`;

  return (
    <header
      data-testid="brand-header"
      className="sticky top-0 z-40 border-b border-dashed border-slate-300 bg-forsides-cream/90 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-6">
        <Link to="/" data-testid="brand-logo" className="group flex shrink-0 items-center gap-3">
          <img src="/forsides-logo.png" alt="FORSIDES, Solutions actuarielles" className="h-10 w-auto sm:h-11" />
          <span className="hidden border-l border-slate-300 pl-3 text-[10px] uppercase tracking-[0.28em] text-forsides-slate xl:inline">
            News Studio
          </span>
        </Link>

        {/* full menu on large screens */}
        <nav className="hidden items-center gap-1 text-sm lg:flex">
          {current && (
            <Link
              to="/studio"
              data-testid="nav-current-post"
              title={current}
              className="mr-2 inline-flex max-w-52 items-center gap-1.5 rounded-full border border-forsides-red/40 bg-white px-3 py-1.5 font-semibold text-forsides-red transition-colors hover:bg-forsides-red hover:text-white"
            >
              <FilePen className="h-4 w-4 shrink-0" /> <span className="truncate">Post en cours</span>
            </Link>
          )}
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} data-testid={l.testid} className={linkCls(l.to)}>
              {l.label}
            </Link>
          ))}
          <a
            href="https://www.forsides.fr"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="nav-forsides-site"
            className="ml-2 whitespace-nowrap rounded-full border border-slate-300 px-3 py-1.5 text-xs text-forsides-slate transition-colors hover:border-forsides-ink hover:bg-forsides-ink hover:text-white"
          >
            forsides.fr ↗
          </a>
          <Link
            to="/settings"
            data-testid="nav-settings"
            title="Style maison"
            aria-label="Style maison"
            className={`ml-1 rounded-full p-2 transition-colors ${
              pathname === "/settings" ? "bg-forsides-red text-white" : "text-forsides-slate hover:text-forsides-red"
            }`}
          >
            <Settings2 className="h-4 w-4" />
          </Link>
        </nav>

        {/* ☰ button on phones and tablets */}
        <button
          type="button"
          data-testid="nav-toggle"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="rounded-lg p-2 text-forsides-ink hover:text-forsides-red lg:hidden"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <nav data-testid="nav-mobile" className="border-t border-slate-200/70 bg-forsides-cream px-4 pb-4 pt-2 lg:hidden">
          {current && (
            <Link to="/studio" data-testid="nav-current-post-mobile" className="mb-1 block rounded-lg bg-white px-4 py-3 text-base font-semibold text-forsides-red ring-1 ring-forsides-red/30">
              ← Post en cours : <span className="font-normal">{current}</span>
            </Link>
          )}
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} data-testid={`${l.testid}-mobile`} className={linkCls(l.to, true)}>
              {l.label}
            </Link>
          ))}
          <Link to="/settings" data-testid="nav-settings-mobile" className={linkCls("/settings", true)}>
            Style maison
          </Link>
          <a href="https://www.forsides.fr" target="_blank" rel="noopener noreferrer" className={linkCls("", true)}>
            www.forsides.fr ↗
          </a>
        </nav>
      )}
    </header>
  );
};
