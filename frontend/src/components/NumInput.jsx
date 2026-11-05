import React, { useEffect, useState } from "react";

// Number box next to a slider: type an exact value, decimals allowed with a comma or a point
// ("50,25", "-12.5"). `scale` converts the stored value to the shown one (e.g. 1.3 → 130 %).
// The value applies as soon as it is valid; ↑ / ↓ change it by 1 (Shift: 10).
const fmt = (n, scale) => String(Math.round(n * scale * 100) / 100).replace(".", ",");

export const NumInput = ({ value, onChange, min, max, scale = 1, suffix = "", testid, label, className = "w-16" }) => {
  const [txt, setTxt] = useState(fmt(Number(value) || 0, scale));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setTxt(fmt(Number(value) || 0, scale)); }, [value, focused, scale]);

  const parse = (t) => {
    const n = parseFloat(String(t).replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  const apply = (shown) => onChange(Math.max(min, Math.min(max, shown)) / scale);

  return (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        data-testid={testid}
        value={txt}
        onFocus={(e) => { setFocused(true); e.target.select(); }}
        onChange={(e) => {
          setTxt(e.target.value);
          const n = parse(e.target.value);
          // live update, except while a decimal is being typed ("50," or "-")
          if (n !== null && !/[,.]$/.test(e.target.value.trim())) apply(n);
        }}
        onBlur={() => {
          setFocused(false);
          const n = parse(txt);
          if (n !== null) apply(n);
          else setTxt(fmt(Number(value) || 0, scale));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const cur = parse(txt) ?? (Number(value) || 0) * scale;
            const next = Math.max(min, Math.min(max, cur + (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : 1)));
            setTxt(fmt(next / scale, scale));
            apply(next);
          }
        }}
        className={`${className} rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-right font-mono text-xs text-forsides-ink outline-none focus:border-forsides-red focus:ring-1 focus:ring-forsides-red/30`}
      />
      {suffix && <span className="font-mono text-[11px] text-forsides-slate">{suffix}</span>}
    </span>
  );
};
