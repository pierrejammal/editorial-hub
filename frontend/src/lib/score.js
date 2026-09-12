export const scoreBand = (score) => {
  if (score >= 90)
    return { label: "PRIORITÉ ÉDITORIALE", color: "#991b1b", medal: "🥇", key: "priority" };
  if (score >= 80)
    return { label: "TRÈS FORT", color: "#2563eb", medal: "🥈", key: "strong" };
  if (score >= 70)
    return { label: "BON SUJET", color: "#059669", medal: "🥉", key: "good" };
  if (score >= 60)
    return { label: "SUJET MOYEN", color: "#d97706", medal: "", key: "medium" };
  return { label: "À ÉCARTER", color: "#64748b", medal: "", key: "discard" };
};

export const priorityMeta = (priority = "") => {
  const p = priority.toUpperCase();
  if (p.includes("PRIORITÉ")) return { color: "#991b1b", medal: "🥇" };
  if (p.includes("TRÈS")) return { color: "#2563eb", medal: "🥈" };
  if (p.includes("BON")) return { color: "#059669", medal: "🥉" };
  return { color: "#64748b", medal: "" };
};

export const SUB_SCORES = [
  { key: "pertinence", label: "Pertinence sectorielle", max: 20 },
  { key: "impact", label: "Importance / impact", max: 20 },
  { key: "actualite", label: "Nouveauté / actualité", max: 15 },
  { key: "fiabilite", label: "Fiabilité de la source", max: 15 },
  { key: "linkedin", label: "Potentiel LinkedIn", max: 15 },
  { key: "vulgarisation", label: "Clarté / vulgarisation", max: 10 },
  { key: "originalite", label: "Originalité", max: 5 },
];
