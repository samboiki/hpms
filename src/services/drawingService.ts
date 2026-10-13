/**
 * Drawings on templates (parity C9): a drawing is a PNG in the private records bucket
 * (<practice>/patient-media/<patient>/drawings/...) with a patient_media row for the visit (category 'photo',
 * subcategory 'drawing'), the way the visit's own photos are kept (src/components/uploads/MediaUploadWrapper.tsx), so
 * the patient file's Media tab lists it with the visit. The rules are in src/utils/clinical/drawings.ts.
 */
import { supabase } from '../lib/supabase';
import { plainWords } from '../utils/plainErrors';
import { RECORDS_BUCKET, recordPath } from './recordPaths';
import { DRAWING_SUBCATEGORY, drawingFileName, drawingTitle, type DrawingTemplateId } from '../utils/clinical/drawings';
import { windhoekClock } from '../utils/patientLists/listDates';

export interface VisitDrawing {
  id: string;
  title: string;
  caption: string | null;
  storagePath: string;
  storageBucket: string | null;
  createdAt: string | null;
}

/** The visit's drawings, oldest first */
export async function loadVisitDrawings(visitId: string): Promise<VisitDrawing[]> {
  const { data, error } = await supabase
    .from('patient_media')
    .select('id, title, description, storage_path, storage_bucket, created_at')
    .eq('visit_id', visitId)
    .eq('subcategory', DRAWING_SUBCATEGORY)
    .order('created_at', { ascending: true });
  if (error) {
    console.error("Could not load the visit's drawings:", error);
    throw new Error("Could not load the visit's drawings.");
  }
  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter((row) => typeof row.id === 'string' && typeof row.storage_path === 'string')
    .map((row) => ({
      id: row.id as string,
      title: typeof row.title === 'string' ? row.title : 'Drawing',
      caption: typeof row.description === 'string' && row.description.trim() ? row.description : null,
      storagePath: row.storage_path as string,
      storageBucket: typeof row.storage_bucket === 'string' ? row.storage_bucket : null,
      createdAt: typeof row.created_at === 'string' ? row.created_at : null
    }));
}

const randomPart = (): string => {
  const bytes = globalThis.crypto?.getRandomValues ? globalThis.crypto.getRandomValues(new Uint8Array(6)) : new Uint8Array(6).map(() => Math.floor(Math.random() * 256));
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0')).join('');
};

/** Saves the drawing with the visit: the PNG first, then its row (the PNG is taken away again when the row fails) */
export async function saveVisitDrawing(request: {
  practiceId: string | null;
  patientId: string;
  visitId: string;
  png: Blob;
  templateId: DrawingTemplateId;
  caption: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false, message: 'Sign in again to save the drawing.' };
  let path: string;
  try {
    path = recordPath(request.practiceId, 'patient-media', request.patientId, 'drawings', drawingFileName(windhoekClock(new Date()).dateKey, randomPart()));
  } catch (error) {
    return { ok: false, message: error instanceof Error ? plainWords(error.message) : 'The drawing could not be saved.' };
  }
  const upload = await supabase.storage.from(RECORDS_BUCKET).upload(path, request.png, { contentType: 'image/png', upsert: false });
  if (upload.error) {
    console.error('Could not upload the drawing:', upload.error);
    return { ok: false, message: 'The drawing could not be saved. Check your connection and try again.' };
  }
  const caption = request.caption.replace(/\s+/g, ' ').trim();
  const { error } = await supabase.from('patient_media').insert([
    {
      patient_id: request.patientId,
      visit_id: request.visitId,
      file_name: path.split('/').pop() ?? 'drawing.png',
      original_name: 'drawing.png',
      file_size: request.png.size,
      file_type: 'png',
      mime_type: 'image/png',
      storage_path: path,
      storage_bucket: RECORDS_BUCKET,
      title: drawingTitle(request.templateId, caption),
      category: 'photo',
      subcategory: DRAWING_SUBCATEGORY,
      description: caption || null,
      tags: null,
      metadata: { kind: DRAWING_SUBCATEGORY, template: request.templateId },
      is_sensitive: false,
      uploaded_by: auth.user.id
    }
  ]);
  if (error) {
    console.error('Could not record the drawing:', error);
    await supabase.storage.from(RECORDS_BUCKET).remove([path]);
    return { ok: false, message: 'The drawing could not be saved with the visit. Please try again.' };
  }
  return { ok: true };
}
