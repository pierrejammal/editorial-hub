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
      className="sticky top-0 z-40 border-b border-slate-200/70 bg-forsides-cream/85 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" data-testid="brand-logo" className="group flex items-center gap-2.5">
          <img src="/forsides-mark.png" alt="FORSIDES" className="h-9 w-auto" />
          <span className="leading-none">
            <span className="block font-sans text-[15px] font-extrabold tracking-[0.14em] text-forsides-ink">
              FORSIDES
            </span>
            <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.34em] text-forsides-slate">
              News Studio
            </span>
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
        </nav>
      )}
    </header>
  );
};
