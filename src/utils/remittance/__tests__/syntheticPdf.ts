/**
 * Writes a small real PDF from positioned text, for the extraction tests. A page can carry
 * /Rotate 90 with its text drawn turned, exactly as the Methealth statements are printed: portrait
 * pages that display as landscape. Positions are given as displayed (x from the left, y = baseline
 * from the top). Invented text only.
 */

export interface SyntheticText {
  str: string;
  x: number;
  y: number;
  size: number;
}

export interface SyntheticPage {
  /** 0 or 90 */
  rotate: 0 | 90;
  /** Displayed width and height (a rotated A4 page displays 842 x 595) */
  width: number;
  height: number;
  texts: SyntheticText[];
}

const escape = (text: string): string => text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const fixed = (value: number): string => (Math.round(value * 100) / 100).toString();

function contentStream(page: SyntheticPage): string {
  return page.texts
    .map(text => {
      // Rotate 90: displayed x is the page's user-space y and displayed y its user-space x, and the
      // text runs "up" the portrait page; unrotated: the y axis points up from the bottom
      const matrix = page.rotate === 90
        ? `0 1 -1 0 ${fixed(text.y)} ${fixed(text.x)}`
        : `1 0 0 1 ${fixed(text.x)} ${fixed(page.height - text.y)}`;
      return `BT /F1 ${fixed(text.size)} Tf ${matrix} Tm (${escape(text.str)}) Tj ET`;
    })
    .join('\n');
}

export function buildPdf(pages: readonly SyntheticPage[]): Uint8Array {
  const objects: string[] = [];
  const add = (body: string): number => {
    objects.push(body);
    return objects.length;
  };
  const catalog = add('');
  const pagesRoot = add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const kids: number[] = [];
  for (const page of pages) {
    const stream = contentStream(page);
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    // The MediaBox is the paper as printed: portrait for a rotated landscape page
    const [mediaWidth, mediaHeight] = page.rotate === 90 ? [page.height, page.width] : [page.width, page.height];
    kids.push(add(`<< /Type /Page /Parent ${pagesRoot} 0 R /MediaBox [0 0 ${mediaWidth} ${mediaHeight}] /Rotate ${page.rotate} /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesRoot} 0 R >>`;
  objects[pagesRoot - 1] = `<< /Type /Pages /Kids [${kids.map(kid => `${kid} 0 R`).join(' ')}] /Count ${kids.length} >>`;

  let text = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(text.length);
    text += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = text.length;
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(offset => {
    text += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  text += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Uint8Array.from(text, char => char.charCodeAt(0) & 0xff);
}
