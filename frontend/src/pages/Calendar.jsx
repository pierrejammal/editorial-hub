import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { BrandHeader } from "@/components/BrandHeader";
import { useStudio } from "@/context/StudioContext";
import { listPosts, getPost } from "@/lib/api";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, FileText } from "lucide-react";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// Monday-first weeks covering the whole month
function monthWeeks(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  const weeks = [];
  const cur = new Date(start);
  while (weeks.length < 6) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
    if (cur.getMonth() !== month && cur > first) break;
  }
  return weeks;
}

const Calendar = () => {
  const nav = useNavigate();
  const { setPost } = useStudio();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });

  useEffect(() => {
    listPosts()
      .then(setPosts)
      .catch(() => toast.error("Impossible de charger les posts"))
      .finally(() => setLoading(false));
  }, []);

  const byDay = useMemo(() => {
    const map = new Map();
    posts.filter((p) => p.scheduled_at).forEach((p) => {
      const d = new Date(p.scheduled_at);
      if (Number.isNaN(d.getTime())) return;
      const k = dayKey(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push({ ...p, when: d });
    });
    map.forEach((list) => list.sort((a, b) => a.when - b.when));
    return map;
  }, [posts]);

  const drafts = posts.filter((p) => !p.scheduled_at);
  const weeks = monthWeeks(cursor.y, cursor.m);
  const monthName = new Date(cursor.y, cursor.m, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const inMonth = (d) => d.getMonth() === cursor.m;
  const monthCount = weeks.flat().filter(inMonth).reduce((n, d) => n + (byDay.get(dayKey(d))?.length || 0), 0);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // a "gap" = a week of this month, not already past, with no post planned
  const isGap = (week) => week.some(inMonth) && week[6] >= startOfToday && !week.some((d) => byDay.has(dayKey(d)));
  const gaps = weeks.filter(isGap).length;

  const move = (delta) => setCursor(({ y, m }) => {
    const d = new Date(y, m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const open = async (id) => {
    try {
      setPost(await getPost(id));
      nav("/studio");
    } catch {
      toast.error("Impossible d'ouvrir ce post");
    }
  };

  return (
    <div className="min-h-screen paper-grain">
      <BrandHeader />
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-12">
        <div className="rise flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forsides-ink text-white">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-serif text-4xl font-black tracking-tight text-forsides-ink">Calendrier éditorial</h1>
              <p className="text-forsides-slate">Vos publications programmées, mois par mois.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => move(-1)} aria-label="Mois précédent" className="rounded-full border border-slate-200 bg-white p-2 hover:border-forsides-red hover:text-forsides-red">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span data-testid="calendar-month" className="min-w-44 text-center font-serif text-xl font-bold capitalize text-forsides-ink">{monthName}</span>
            <button onClick={() => move(1)} aria-label="Mois suivant" className="rounded-full border border-slate-200 bg-white p-2 hover:border-forsides-red hover:text-forsides-red">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCursor({ y: today.getFullYear(), m: today.getMonth() })}
              className="ml-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-forsides-slate hover:border-forsides-red hover:text-forsides-red"
            >
              Aujourd'hui
            </button>
          </div>
        </div>

        <p data-testid="calendar-stats" className="mt-6 text-sm text-forsides-slate">
          <span className="font-semibold text-forsides-ink">{monthCount} post{monthCount > 1 ? "s" : ""}</span> programmé{monthCount > 1 ? "s" : ""} ce mois-ci
          {gaps > 0 && (
            <> · <span className="font-semibold text-amber-700">{gaps} semaine{gaps > 1 ? "s" : ""} sans publication</span> à venir</>
          )}
        </p>

        {loading ? (
          <div className="mt-16 flex justify-center text-forsides-slate"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_280px]">
            <div className="overflow-x-auto">
              <div className="min-w-[720px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="grid grid-cols-7 border-b border-slate-200 bg-forsides-cream/60">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500">{d}</div>
                  ))}
                </div>
                {weeks.map((week, wi) => {
                  const gap = isGap(week);
                  return (
                    <div key={wi} className={`relative grid grid-cols-7 border-b border-slate-100 last:border-b-0 ${gap ? "bg-amber-50/50" : ""}`}>
                      {gap && (
                        <span className="pointer-events-none absolute bottom-1.5 right-2 font-mono text-[9px] uppercase tracking-widest text-amber-600">
                          Aucun post cette semaine
                        </span>
                      )}
                      {week.map((d) => {
                        const items = byDay.get(dayKey(d)) || [];
                        const isToday = sameDay(d, today);
                        return (
                          <div key={d.toISOString()} className={`min-h-28 border-r border-slate-100 p-1.5 last:border-r-0 ${inMonth(d) ? "" : "bg-slate-50/70"}`}>
                            <div className={`mb-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${
                              isToday ? "bg-forsides-red text-white" : inMonth(d) ? "text-forsides-ink" : "text-slate-300"
                            }`}>
                              {d.getDate()}
                            </div>
                            <div className="space-y-1">
                              {items.map((p) => (
                                <button
                                  key={p.id}
                                  data-testid="calendar-post"
                                  onClick={() => open(p.id)}
                                  title={p.title}
                                  className={`block w-full rounded-md px-1.5 py-1 text-left text-[11px] leading-tight transition-colors ${
                                    p.when < today ? "bg-slate-100 text-slate-500 hover:bg-slate-200" : "bg-forsides-red/10 text-forsides-bordeaux hover:bg-forsides-red/20"
                                  }`}
                                >
                                  <span className="font-mono font-semibold">
                                    {p.when.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                  </span>{" "}
                                  <span className="line-clamp-2">{p.title}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:self-start">
              <h2 className="font-serif text-base font-bold text-forsides-ink">À programmer</h2>
              <p className="mt-0.5 text-xs text-slate-500">Posts enregistrés sans date de publication.</p>
              {drafts.length === 0 ? (
                <p className="mt-4 text-sm text-forsides-slate">Aucun brouillon en attente.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {drafts.slice(0, 12).map((p) => (
                    <li key={p.id}>
                      <button
                        data-testid="calendar-draft"
                        onClick={() => open(p.id)}
                        className="flex w-full items-start gap-2 rounded-lg border border-slate-100 p-2 text-left hover:border-forsides-red"
                      >
                        {p.thumbnail ? (
                          <img src={p.thumbnail} alt="" className="h-12 w-10 shrink-0 rounded object-cover" />
                        ) : (
                          <FileText className="h-5 w-5 shrink-0 text-slate-300" />
                        )}
                        <span className="line-clamp-3 text-xs font-medium text-forsides-ink">{p.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-[11px] text-slate-400">
                Ouvrez un post puis cliquez sur « Programmer » pour lui donner une date.
              </p>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
};

export default Calendar;
