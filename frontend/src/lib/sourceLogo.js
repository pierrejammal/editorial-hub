import { loadImage, sourceLogoSrc } from "@/lib/visualRender";
import { logoProxyUrl } from "@/lib/api";
import { prepareLogo } from "@/lib/logoImage";

const cache = new Map();

/**
 * Which source logo the visual shows, in order:
 * hidden → none; logo imported by the user; official file from the institution library;
 * logo found automatically on the source's own website (trimmed of its margins).
 * Returns { img, origin: "hidden" | "upload" | "library" | "site" | "none" }.
 */
export async function resolveSourceLogo(post) {
  const v = post?.visual || {};
  const m = post?.meta || {};
  if (v.hide_source_logo) return { img: null, origin: "hidden" };
  if (v.source_logo) return { img: await loadImage(v.source_logo), origin: "upload" };
  const lib = sourceLogoSrc(m.source);
  if (lib) return { img: await loadImage(lib), origin: "library" };
  if (m.source_logo_url) {
    const key = m.source_logo_url;
    if (!cache.has(key)) {
      cache.set(key, (async () => {
        try {
          return await loadImage(await prepareLogo(logoProxyUrl(key)));
        } catch {
          return null;
        }
      })());
    }
    const img = await cache.get(key);
    if (img) return { img, origin: "site" };
  }
  return { img: null, origin: "none" };
}
