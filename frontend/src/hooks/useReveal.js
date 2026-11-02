import { useEffect, useRef } from "react";

// Fades/slides an element in the first time it scrolls into view. The element stays visible
// if JS or IntersectionObserver is missing (it is only hidden once the observer is armed).
export function useReveal(delay = 0) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.9) return undefined; // already on screen: no hide/show flash
    el.style.setProperty("--d", `${delay}ms`);
    el.classList.add("rv-armed");
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add("rv-in"); io.disconnect(); }
    }, { rootMargin: "0px 0px -10% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return ref;
}
