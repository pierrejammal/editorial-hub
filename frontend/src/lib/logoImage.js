// Prepares an uploaded logo: removes empty/white margins around it (they make the logo look tiny)
// and limits its size so it can be stored with the post.

const loadImg = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

/** @returns {Promise<string>} PNG data URL of the trimmed, resized logo */
export async function prepareLogo(dataUrl, maxSide = 700) {
  const img = await loadImg(dataUrl);
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  let data;
  try {
    data = ctx.getImageData(0, 0, c.width, c.height).data;
  } catch {
    return dataUrl; // unreadable image: keep it as it is
  }
  // a pixel is "content" if it isn't transparent and isn't (almost) white
  const isContent = (i) => data[i + 3] > 24 && !(data[i] > 242 && data[i + 1] > 242 && data[i + 2] > 242);
  let top = c.height, left = c.width, right = -1, bottom = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (isContent((y * c.width + x) * 4)) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return dataUrl; // blank image
  const pad = Math.round(Math.max(right - left, bottom - top) * 0.02);
  left = Math.max(0, left - pad); top = Math.max(0, top - pad);
  right = Math.min(c.width - 1, right + pad); bottom = Math.min(c.height - 1, bottom + pad);
  const w = right - left + 1;
  const h = bottom - top + 1;
  const k = Math.min(1, maxSide / Math.max(w, h));
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(w * k));
  out.height = Math.max(1, Math.round(h * k));
  out.getContext("2d").drawImage(c, left, top, w, h, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}
