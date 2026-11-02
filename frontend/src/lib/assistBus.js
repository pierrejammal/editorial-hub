// Link between the AI assistant and the visual preview:
// - the preview reports what the user is looking at (format, carousel page) so "cette page" means something;
// - the assistant announces "I just changed X" so the preview flashes and jumps to the right page.
let view = { format: "A", page: 0, pageCount: 0, pageKind: null, pageLabel: "" };

export const setAssistView = (v) => { view = { ...view, ...v }; };
export const getAssistView = () => view;

const EVT = "forsides:ai-change";
export const emitAiChange = (detail) => {
  try { window.dispatchEvent(new CustomEvent(EVT, { detail })); } catch { /* no window (tests) */ }
};
export const onAiChange = (fn) => {
  const h = (e) => fn(e.detail || {});
  window.addEventListener(EVT, h);
  return () => window.removeEventListener(EVT, h);
};

// Which carousel page shows a given field (first match wins)
const FIELD_PAGE = [
  [["chart", "data_points", "important_date"], "data"],
  [["key_figure_value", "key_figure_label", "fact", "custom", "key_figure"], "essential"],
  [["what_changes", "why_important"], "points"],
  [["insight", "insight_line", "cta_question", "cta_text"], "takeaway"],
  [["title_short", "subtitle"], "cover"],
];
export const pageKindForFields = (fields) => {
  for (const [keys, kind] of FIELD_PAGE) if (fields.some((f) => keys.includes(f))) return kind;
  return null;
};
