// Minimal PDF writer: one full-page JPEG per page. Enough for a LinkedIn carousel
// (LinkedIn "document" posts) without adding a PDF library to the app.

const enc = new TextEncoder();

const dataUrlToBytes = (dataUrl) => {
  const b64 = dataUrl.split(",")[1] || "";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/**
 * @param {{dataUrl: string, width: number, height: number}[]} pages JPEG data URLs (pixel size)
 * @param {number} pageWidthPt PDF page width in points; height follows the image ratio
 * @returns {Blob}
 */
export function jpegsToPdf(pages, pageWidthPt = 540) {
  const chunks = [];
  const offsets = [];
  let pos = 0;
  const push = (part) => {
    const bytes = typeof part === "string" ? enc.encode(part) : part;
    chunks.push(bytes);
    pos += bytes.length;
  };
  const obj = (num, body) => {
    offsets[num] = pos;
    push(`${num} 0 obj\n`);
    body();
    push("\nendobj\n");
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const n = pages.length;
  // object numbers: 1 catalog, 2 pages, then per page: page, content, image
  const pageNum = (i) => 3 + i * 3;

  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => push(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${pageNum(i)} 0 R`).join(" ")}] >>`));

  pages.forEach((p, i) => {
    const w = pageWidthPt;
    const h = Math.round((pageWidthPt * p.height) / p.width);
    const img = dataUrlToBytes(p.dataUrl);
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    obj(pageNum(i), () => push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
      `/Resources << /XObject << /Im0 ${pageNum(i) + 2} 0 R >> >> /Contents ${pageNum(i) + 1} 0 R >>`
    ));
    obj(pageNum(i) + 1, () => {
      push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    });
    obj(pageNum(i) + 2, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`);
      push(img);
      push("\nendstream");
    });
  });

  const total = 3 + n * 3;
  const xrefPos = pos;
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let k = 1; k < total; k++) xref += `${String(offsets[k]).padStart(10, "0")} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);
  return new Blob(chunks, { type: "application/pdf" });
}
