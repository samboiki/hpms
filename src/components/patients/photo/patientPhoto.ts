/**
 * The patient's photo (owner's decision, 13 Oct 2026; parity A12): taken with the device's camera or chosen from a
 * file, made small in the browser (at most PHOTO_MAX_SIDE pixels on its longest side, JPEG) and stored in the private
 * "records" bucket under <practice id>/patient-media/<patient id>/photo-<time>.jpg. patients.photo_path holds the
 * path; a link that works for a few minutes is made when the photo is shown (patientPhotoService.ts).
 */
import { recordPath } from '../../../services/recordPaths';

/** Longest side in pixels: sharp enough to recognise a face on a 2x screen, small enough to load at once in a list */
export const PHOTO_MAX_SIDE = 512;
export const PHOTO_JPEG_QUALITY = 0.82;
/** A photo larger than this is refused before it is read (phone cameras make files of 3 to 12 MB) */
export const PHOTO_MAX_INPUT_BYTES = 25 * 1024 * 1024;

/** The size to draw at: the same shape, never larger than the photo itself */
export function fitWithin(width: number, height: number, maxSide = PHOTO_MAX_SIDE): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Why a chosen file cannot be used as a photo; null when it can */
export function photoFileProblem(file: { type: string; size: number }): string | null {
  if (!file.type.startsWith('image/')) return 'Choose a photo (a JPEG, PNG or similar image).';
  if (file.size > PHOTO_MAX_INPUT_BYTES) return 'This photo is too large. Choose one under 25 MB.';
  return null;
}

/** Where a new photo of this patient is stored; a new name each time, so a changed photo is never served from cache */
export function patientPhotoPath(practiceId: string | null | undefined, patientId: string, now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:.TZ]/g, '');
  return recordPath(practiceId, 'patient-media', patientId, `photo-${stamp}.jpg`);
}

/** True for a path this practice's photos are stored under: anything else on the row is never signed or removed */
export function isPatientPhotoPath(path: string | null | undefined, patientId: string): boolean {
  if (!path) return false;
  const [practice = '', kind = '', patient = '', name = '', ...rest] = path.split('/');
  return /^[0-9a-f-]{36}$/i.test(practice) && kind === 'patient-media' && patient === patientId && /^photo-[0-9]+\.jpg$/.test(name) && rest.length === 0;
}

/** Reads an image into something a canvas can draw (honouring the phone's rotation where the browser can) */
async function loadImage(source: Blob): Promise<{ image: CanvasImageSource; width: number; height: number; done: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
      return { image: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() };
    } catch {
      // Some browsers refuse the options or the format: fall back to an <img>
    }
  }
  const url = URL.createObjectURL(source);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('This photo could not be read. Try another one.'));
      element.src = url;
    });
    return { image: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/** The photo made small (PHOTO_MAX_SIDE) as a JPEG, ready to store */
export async function compressPhoto(source: Blob | HTMLVideoElement): Promise<Blob> {
  const loaded = source instanceof Blob
    ? await loadImage(source)
    : { image: source, width: source.videoWidth, height: source.videoHeight, done: () => undefined };
  try {
    const size = fitWithin(loaded.width, loaded.height);
    if (size.width === 0) throw new Error('This photo could not be read. Try another one.');
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This device cannot prepare the photo. Try another browser.');
    // A white background: a transparent PNG would otherwise turn black as a JPEG
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(loaded.image, 0, 0, size.width, size.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('The photo could not be prepared. Try again.'))), 'image/jpeg', PHOTO_JPEG_QUALITY);
    });
  } finally {
    loaded.done();
  }
}
