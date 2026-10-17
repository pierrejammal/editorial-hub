// "Version anglaise": builds the payload to translate and merges the translation into a new post.
const MONTHS_FR = ["JANVIER", "FÉVRIER", "MARS", "AVRIL", "MAI", "JUIN", "JUILLET", "AOÛT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DÉCEMBRE"];
const MONTHS_EN = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

export const englishDateLabel = (label) => {
  let out = String(label || "");
  MONTHS_FR.forEach((m, i) => { out = out.replace(m, MONTHS_EN[i]); });
  return out;
};

export function translationPayload(post) {
  const v = post.visual || {};
  const ed = post.editorial || {};
  const m = post.meta || {};
  return {
    caption: post.caption || "",
    visual: {
      title_short: v.title_short || "",
      subtitle: v.subtitle || "",
      key_figure_value: v.key_figure_value || "",
      key_figure_label: v.key_figure_label || "",
      important_date: v.important_date || "",
      data_points: v.data_points || [],
      insight_line: v.insight_line || "",
      chart: v.chart ? { title: v.chart.title || "", note: v.chart.note || "", unit: v.chart.unit || "",
        labels: (v.chart.items || []).map((it) => String(it.label || "")) } : null,
      custom: v.custom ? { summary: v.custom.summary || "", points: (v.custom.points || []).map((p) => ({ label: p.label || "", text: p.text || "" })) } : null,
    },
    editorial: {
      fact: ed.fact || "", what_changes: ed.what_changes || "", why_important: ed.why_important || "",
      insight: ed.insight || "", angle: ed.angle || "",
    },
    meta: { topic: m.topic || "", sector: m.sector || "", source_title: m.source_title || "" },
  };
}

const pickStr = (tr, orig) => (typeof tr === "string" && (tr.trim() || !orig) ? tr : orig);
const pickList = (tr, orig) => (Array.isArray(tr) && tr.length === (orig || []).length ? tr : orig);

export function mergeTranslation(post, tr, frenchId) {
  const v = post.visual || {};
  const tv = tr.visual || {};
  const ted = tr.editorial || {};
  const tm = tr.meta || {};
  const chart = v.chart
    ? {
        ...v.chart,
        title: pickStr(tv.chart?.title, v.chart.title),
        note: pickStr(tv.chart?.note, v.chart.note),
        unit: pickStr(tv.chart?.unit, v.chart.unit),
        items: v.chart.items.map((it, i) => ({ ...it, label: pickStr(tv.chart?.labels?.[i], it.label) })),
      }
    : v.chart;
  const custom = v.custom
    ? {
        summary: pickStr(tv.custom?.summary, v.custom.summary),
        points: (v.custom.points || []).map((p, i) => ({
          label: pickStr(tv.custom?.points?.[i]?.label, p.label),
          text: pickStr(tv.custom?.points?.[i]?.text, p.text),
        })),
      }
    : v.custom;
  return {
    ...post,
    id: null, // a new post: the French one stays as it is
    translated_from: frenchId || post.id || null,
    caption: pickStr(tr.caption, post.caption),
    quality: null,
    visual: {
      ...v,
      title_short: pickStr(tv.title_short, v.title_short),
      subtitle: pickStr(tv.subtitle, v.subtitle),
      key_figure_value: pickStr(tv.key_figure_value, v.key_figure_value),
      key_figure_label: pickStr(tv.key_figure_label, v.key_figure_label),
      important_date: pickStr(tv.important_date, v.important_date),
      data_points: pickList(tv.data_points, v.data_points),
      insight_line: pickStr(tv.insight_line, v.insight_line),
      chart,
      custom,
    },
    editorial: Object.fromEntries(Object.entries({ ...(post.editorial || {}) }).map(([k, val]) => [k, pickStr(ted[k], val)])),
    meta: {
      ...(post.meta || {}),
      lang: "en",
      topic: pickStr(tm.topic, post.meta?.topic),
      sector: pickStr(tm.sector, post.meta?.sector),
      source_title: pickStr(tm.source_title, post.meta?.source_title),
      date_label: englishDateLabel(post.meta?.date_label),
    },
  };
}
