import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

const KEY = "forsides.panels";
const readOpen = (id, fallback) => {
  try {
    const all = JSON.parse(window.localStorage.getItem(KEY) || "{}");
    return id in all ? Boolean(all[id]) : fallback;
  } catch {
    return fallback;
  }
};
const writeOpen = (id, open) => {
  try {
    const all = JSON.parse(window.localStorage.getItem(KEY) || "{}");
    window.localStorage.setItem(KEY, JSON.stringify({ ...all, [id]: open }));
  } catch { /* storage blocked */ }
};

// A card that opens/closes with one click on its header. Closed, it keeps a short summary
// (score, number of figures to check…) visible. Open/closed is remembered per panel.
export const Collapsible = ({ id, title, icon, summary, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(() => readOpen(id, defaultOpen));
  const toggle = () => setOpen((o) => { writeOpen(id, !o); return !o; });

  return (
    <section data-testid={`panel-${id}`} className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <button
        type="button"
        data-testid={`panel-toggle-${id}`}
        aria-expanded={open}
        onClick={toggle}
        className={`flex w-full items-center justify-between gap-3 px-6 text-left transition-colors hover:bg-forsides-cream/40 ${open ? "pb-2 pt-5" : "py-4"} rounded-xl`}
      >
        <span className="flex min-w-0 items-center gap-2 font-serif text-lg font-bold text-forsides-ink">
          {icon}
          <span className="truncate">{title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {summary}
          <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && <div className="px-6 pb-6 pt-2">{children}</div>}
    </section>
  );
};
