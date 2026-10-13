/**
 * A ZIP archive of files kept as they are (no compression: the documents in a patient record are PDFs and photos,
 * which are compressed already). Used by the patient record export (src/services/patientRecordExportService.ts).
 * File names are UTF-8 (flag bit 11), so names with accents open correctly in Windows, macOS and phone viewers.
 *
 * Format: PKWARE APPNOTE 6.3 (local headers, the central directory, the end record). No ZIP64: an archive holds fewer
 * than 65,535 files and less than 4 GB, which the export checks before it starts.
 */

export interface ZipEntry {
  /** The path inside the archive, folders separated by "/" ("documents/visit-12-oct.pdf") */
  name: string;
  data: Uint8Array;
  /** Shown as the file's date in the archive; defaults to now */
  modified?: Date;
}

/** Largest archive this writer makes (no ZIP64) */
export const MAX_ZIP_BYTES = 0xffffffff;
export const MAX_ZIP_ENTRIES = 0xffff;

let crcTable: Uint32Array | null = null;

function table(): Uint32Array {
  if (crcTable) return crcTable;
  const result = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    result[n] = c >>> 0;
  }
  crcTable = result;
  return result;
}

/** CRC-32 (IEEE 802.3), the checksum a ZIP stores for each file. */
export function crc32(data: Uint8Array): number {
  const lookup = table();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) crc = lookup[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS date and time, as ZIP stores them (2-second steps, years 1980-2107). */
function dosDateTime(date: Date): { time: number; day: number } {
  const year = Math.min(Math.max(date.getFullYear(), 1980), 2107);
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

const encoder = new TextEncoder();

/**
 * A safe path inside the archive: folders and a name without "..", drive letters, a leading "/", backslashes or
 * characters Windows refuses, so unpacking can never write outside the folder the archive is opened in.
 */
export function safeZipPath(path: string): string {
  const parts = path
    .replace(/\\/g, '/')
    .split('/')
    .map(part =>
      part
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f<>:"|?*]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^\.+$/, '_')
        .slice(0, 120)
    )
    .filter(part => part !== '');
  return parts.join('/') || 'file';
}

/** The names made unique the way file managers do: "scan.pdf", "scan (2).pdf", "scan (3).pdf". */
export function uniqueZipPaths(paths: readonly string[]): string[] {
  const taken = new Set<string>();
  return paths.map(path => {
    let candidate = path;
    const dot = path.lastIndexOf('.');
    const slash = path.lastIndexOf('/');
    const hasExtension = dot > slash + 1;
    const stem = hasExtension ? path.slice(0, dot) : path;
    const extension = hasExtension ? path.slice(dot) : '';
    for (let n = 2; taken.has(candidate.toLowerCase()); n += 1) candidate = `${stem} (${n})${extension}`;
    taken.add(candidate.toLowerCase());
    return candidate;
  });
}

/** The archive's bytes. Throws when it would hold too many files or too many bytes for a plain ZIP. */
export function zipStore(entries: readonly ZipEntry[]): Uint8Array {
  if (entries.length > MAX_ZIP_ENTRIES) throw new RangeError('Too many files for one archive.');
  const now = new Date();
  const prepared = entries.map(entry => {
    const name = encoder.encode(safeZipPath(entry.name));
    return { name, data: entry.data, crc: crc32(entry.data), stamp: dosDateTime(entry.modified ?? now) };
  });
  const localSize = prepared.reduce((sum, entry) => sum + 30 + entry.name.length + entry.data.length, 0);
  const centralSize = prepared.reduce((sum, entry) => sum + 46 + entry.name.length, 0);
  const total = localSize + centralSize + 22;
  if (total > MAX_ZIP_BYTES) throw new RangeError('The files are too large for one archive.');

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let offset = 0;
  const offsets: number[] = [];

  for (const entry of prepared) {
    offsets.push(offset);
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true); // version needed: 2.0
    view.setUint16(offset + 6, 0x0800, true); // UTF-8 names
    view.setUint16(offset + 8, 0, true); // stored
    view.setUint16(offset + 10, entry.stamp.time, true);
    view.setUint16(offset + 12, entry.stamp.day, true);
    view.setUint32(offset + 14, entry.crc, true);
    view.setUint32(offset + 18, entry.data.length, true);
    view.setUint32(offset + 22, entry.data.length, true);
    view.setUint16(offset + 26, entry.name.length, true);
    view.setUint16(offset + 28, 0, true);
    out.set(entry.name, offset + 30);
    out.set(entry.data, offset + 30 + entry.name.length);
    offset += 30 + entry.name.length + entry.data.length;
  }

  const centralStart = offset;
  prepared.forEach((entry, index) => {
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true); // made by: 2.0
    view.setUint16(offset + 6, 20, true);
    view.setUint16(offset + 8, 0x0800, true);
    view.setUint16(offset + 10, 0, true);
    view.setUint16(offset + 12, entry.stamp.time, true);
    view.setUint16(offset + 14, entry.stamp.day, true);
    view.setUint32(offset + 16, entry.crc, true);
    view.setUint32(offset + 20, entry.data.length, true);
    view.setUint32(offset + 24, entry.data.length, true);
    view.setUint16(offset + 28, entry.name.length, true);
    // extra field, comment, disk number, internal and external attributes: none
    view.setUint32(offset + 42, offsets[index], true);
    out.set(entry.name, offset + 46);
    offset += 46 + entry.name.length;
  });

  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 8, prepared.length, true);
  view.setUint16(offset + 10, prepared.length, true);
  view.setUint32(offset + 12, offset - centralStart, true);
  view.setUint32(offset + 16, centralStart, true);
  return out;
}
