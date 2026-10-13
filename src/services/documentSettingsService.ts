/**
 * Reads and saves the practice's document settings (src/utils/billing/documentSettings.ts): the message on invoices,
 * quotes and statements (parity D22) and whether statements leave settled items off (parity D26). One practice_settings
 * row; its policies let every staff member read it and only administrators change it.
 */
import { supabase } from '../lib/supabase';
import type { Json } from '../types/database.types';
import {
  DEFAULT_DOCUMENT_SETTINGS,
  DOCUMENT_SETTINGS_KEY,
  checkDocumentSettings,
  documentSettingsJson,
  parseDocumentSettings,
  type DocumentSettings
} from '../utils/billing/documentSettings';

/** The practice's settings; the defaults (no message, settled items shown) when none are saved or they cannot be read */
export async function loadDocumentSettings(practiceId: string): Promise<DocumentSettings> {
  try {
    const { data, error } = await supabase
      .from('practice_settings')
      .select('setting_value')
      .eq('practice_id', practiceId)
      .eq('setting_key', DOCUMENT_SETTINGS_KEY)
      .limit(1);
    if (error) return DEFAULT_DOCUMENT_SETTINGS;
    return parseDocumentSettings(data?.[0]?.setting_value ?? null);
  } catch {
    // A document is never held up by its message
    return DEFAULT_DOCUMENT_SETTINGS;
  }
}

/** Saves them (practice administrators only: the database refuses anyone else, said here in plain words) */
export async function saveDocumentSettings(practiceId: string, settings: DocumentSettings): Promise<DocumentSettings> {
  const check = checkDocumentSettings(settings);
  if (!check.ok) throw new Error(check.error ?? 'Check the settings');
  const clean = parseDocumentSettings(documentSettingsJson(settings));
  const { error } = await supabase.from('practice_settings').upsert(
    {
      practice_id: practiceId,
      setting_key: DOCUMENT_SETTINGS_KEY,
      setting_value: documentSettingsJson(clean) as unknown as Json,
      setting_type: 'json',
      description: 'Documents: the practice message on invoices, quotes and statements, and whether statements leave settled items off',
      is_public: false
    },
    { onConflict: 'practice_id,setting_key' }
  );
  if (error) {
    const refused = error.code === '42501' || /row-level security|permission denied/i.test(error.message ?? '');
    throw new Error(refused ? 'Only a practice administrator can change these settings.' : `The settings were not saved: ${error.message}`);
  }
  return clean;
}
