// Competitors removed from "Explorer un sujet". Same default list as the server
// (backend/server.py DEFAULT_COMPETITORS); the user's edits are remembered in this browser.
export const DEFAULT_COMPETITORS = [
  "Milliman", "Addactis", "Optimind", "Actuelia", "Galea", "Fixage", "Prim'Act", "Actuaris",
  "SeaBird", "Sia Partners", "Mazars", "Forvis Mazars", "Deloitte", "KPMG", "EY", "Ernst & Young",
  "PwC", "PricewaterhouseCoopers", "Accenture", "Aon", "WTW", "Willis Towers Watson", "Mercer",
  "Nexialog", "Arengi", "Finalyse", "Reacfin", "Grant Thornton", "BDO", "Wavestone", "Capgemini",
];

const KEY = "forsides.competitors";

export const loadCompetitors = () => {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw != null ? raw : DEFAULT_COMPETITORS.join(", ");
  } catch {
    return DEFAULT_COMPETITORS.join(", ");
  }
};

export const saveCompetitors = (text) => {
  try { window.localStorage.setItem(KEY, text); } catch { /* storage blocked: keep for this session only */ }
};

export const parseCompetitors = (text) =>
  String(text || "").split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
