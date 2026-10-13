import { describe, expect, it } from 'vitest';
import { crc32 as nodeCrc32 } from 'node:zlib';
import { crc32, safeZipPath, uniqueZipPaths, zipStore } from '../zipStore';

const bytes = (text: string) => new TextEncoder().encode(text);

/** Reads an archive the way an unzip tool does: from the end record through the central directory to each file. */
function readZip(archive: Uint8Array): Array<{ name: string; data: Uint8Array; crc: number; flags: number }> {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const end = archive.byteLength - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const files = [];
  for (let i = 0; i < count; i += 1) {
    expect(view.getUint32(offset, true)).toBe(0x02014b50);
    const flags = view.getUint16(offset + 8, true);
    const crc = view.getUint32(offset + 16, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const local = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(archive.subarray(offset + 46, offset + 46 + nameLength));
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    const localName = view.getUint16(local + 26, true);
    const dataStart = local + 30 + localName + view.getUint16(local + 28, true);
    files.push({ name, crc, flags, data: archive.subarray(dataStart, dataStart + size) });
    offset += 46 + nameLength;
  }
  return files;
}

describe('the record export archive', () => {
  it('computes the same CRC-32 as zlib, so unzip tools accept every file', () => {
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926);
    const random = new Uint8Array(5000).map((_, i) => (i * 7919) % 251);
    expect(crc32(random)).toBe(nodeCrc32(random));
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('keeps every file byte for byte under its name, so the PDFs and photos open as they were stored', () => {
    const pdf = bytes('%PDF-1.7 invented');
    const photo = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    const archive = zipStore([
      { name: 'record-summary.pdf', data: pdf },
      { name: 'documents/scan of ID.jpg', data: photo, modified: new Date(2026, 9, 13, 10, 42, 30) }
    ]);
    const files = readZip(archive);
    expect(files.map(file => file.name)).toEqual(['record-summary.pdf', 'documents/scan of ID.jpg']);
    expect(Array.from(files[0].data)).toEqual(Array.from(pdf));
    expect(Array.from(files[1].data)).toEqual(Array.from(photo));
    expect(files[1].crc).toBe(nodeCrc32(photo));
  });

  it('marks names as UTF-8, so a patient name with an accent unpacks correctly', () => {
    const [file] = readZip(zipStore([{ name: 'documents/Nangolo Ndéyapo.pdf', data: bytes('x') }]));
    expect(file.name).toBe('documents/Nangolo Ndéyapo.pdf');
    expect(file.flags & 0x0800).toBe(0x0800);
  });

  it('makes an empty archive that tools still open', () => {
    const archive = zipStore([]);
    expect(archive.byteLength).toBe(22);
    expect(readZip(archive)).toEqual([]);
  });
});

describe('names inside the archive', () => {
  it('never lets a stored file name climb out of the folder the archive is unpacked in', () => {
    expect(safeZipPath('../../etc/passwd')).toBe('_/_/etc/passwd');
    expect(safeZipPath('/documents\\scan.pdf')).toBe('documents/scan.pdf');
    expect(safeZipPath('C:\\temp\\x.pdf')).toBe('C_/temp/x.pdf');
    expect(safeZipPath('  a  b?.pdf ')).toBe('a b_.pdf');
    expect(safeZipPath('')).toBe('file');
  });

  it('numbers files with the same name instead of letting one overwrite another', () => {
    expect(uniqueZipPaths(['documents/scan.pdf', 'documents/Scan.pdf', 'documents/scan.pdf', 'notes'])).toEqual([
      'documents/scan.pdf',
      'documents/Scan (2).pdf',
      'documents/scan (3).pdf',
      'notes'
    ]);
  });
});
