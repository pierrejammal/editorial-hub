import React, { useEffect, useRef } from "react";
import { renderVisual, loadImage, sourceLogoSrc, FONT_SET, VW, VH } from "@/lib/visualRender";
import { renderCarousel } from "@/lib/carouselRender";
import { useStudio } from "@/context/StudioContext";

// Read-only FORSIDES visual drawn with the app's real renderer and the house template.
// page != null → that page of the carousel.
export const VisualCanvas = ({ post, version = "A", page = null, className = "", label = "Exemple de visuel FORSIDES" }) => {
  const ref = useRef(null);
  const { template } = useStudio() || {};

  useEffect(() => {
    let cancelled = false;
    const draw = async () => {
      const [logoImg, sourceLogoImg] = await Promise.all([
        loadImage("/forsides-logo.png"),
        loadImage(sourceLogoSrc(post.meta?.source)),
      ]);
      const c = ref.current;
      if (cancelled || !c) return;
      const images = { logoImg, sourceLogoImg };
      try {
        if (page != null) {
          const pages = renderCarousel(post, images, (w, h) => { const x = document.createElement("canvas"); x.width = w; x.height = h; return x; }, template);
          const src = pages[Math.min(page, pages.length - 1)];
          const ctx = c.getContext("2d");
          ctx.clearRect(0, 0, VW, VH);
          ctx.drawImage(src, 0, 0);
        } else {
          renderVisual(c.getContext("2d"), { post, version, images, template });
        }
      } catch (e) {
        console.error("visual render failed", e);
      }
    };
    draw();
    Promise.all(FONT_SET.map((f) => document.fonts.load(f).catch(() => {}))).then(() => !cancelled && draw());
    return () => { cancelled = true; };
  }, [post, version, page, template]);

  return (
    <canvas ref={ref} width={VW} height={VH} role="img" aria-label={label}
      className={`block h-auto w-full bg-[#F7E8E4] shadow-[0_2rem_4rem_-2rem_rgba(15,23,42,0.35)] ${className}`} />
  );
};
