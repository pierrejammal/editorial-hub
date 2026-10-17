import { useState } from "react";

// Tone of the AI writing. "" = the house default set in "Style maison".
export const TONES = [
  { key: "", label: "Par défaut", hint: "Le ton défini dans Style maison" },
  { key: "standard", label: "Équilibré", hint: "Professionnel et accessible" },
  { key: "expert", label: "Expert technique", hint: "Vocabulaire actuariel précis, pour des spécialistes" },
  { key: "pedagogique", label: "Pédagogique", hint: "Notions expliquées simplement, public large" },
  { key: "alerte", label: "Alerte réglementaire", hint: "Obligation, échéance, qui est concerné, quoi faire" },
];

const KEY = "forsides.tone";
const read = () => {
  try { return window.localStorage.getItem(KEY) || ""; } catch { return ""; }
};

// Remembered between pages and visits (this browser only)
export function useTone() {
  const [tone, setToneState] = useState(read);
  const setTone = (t) => {
    setToneState(t);
    try { window.localStorage.setItem(KEY, t); } catch { /* storage blocked */ }
  };
  return [tone, setTone];
}
