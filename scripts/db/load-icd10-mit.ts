/**
 * Loads the South African ICD-10 Master Industry Table (MIT: the Excel file the medical aids publish; Namibian funds
 * validate claims against it too) into public.icd10_codes (proposals/2026-10-12-icd10-master.sql). The same script
 * loads a newer MIT later: codes are upserted by code, so a changed code is updated and nothing is deleted (a newer MIT
 * keeps its discontinued codes, marked D).
 *
 *   npx tsx scripts/db/load-icd10-mit.ts <file.xlsx> [--source "SA MIT 2021"] [--dry-run]
 *
 * Every row is mapped and checked first (scripts/db/icd10Mit.ts: no repeated code, flags Y or N only, dates and age
 * ranges understood); nothing is written unless every row passes. Rows go in batches of 1,000 with the service key:
 * VITE_SUPABASE_URL and SUPABASE_SECRET_KEY from .env, never printed. The output is counts only. --dry-run checks the
 * file without writing. --source names the list (default: the year in the sheet or file name, "SA MIT 2021").
 */
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { inBatches, isMitHeader, mapMitRows, mitSourceName } from './icd10Mit.ts';

const BATCH_SIZE = 1000;
const MAX_ERRORS_SHOWN = 25;

interface Options {
  file: string | null;
  source: string | null;
  dryRun: boolean;
}

function parseOptions(argv: readonly string[]): Options {
  const rest = [...argv];
  const sourceAt = rest.indexOf('--source');
  const source = sourceAt >= 0 ? (rest.splice(sourceAt, 2)[1] ?? '').trim() || null : null;
  return { file: rest.find(arg => !arg.startsWith('--')) ?? null, source, dryRun: rest.includes('--dry-run') };
}

/** The first row of a sheet. */
function firstRow(sheet: XLSX.WorkSheet): unknown[] {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  range.e.r = range.s.r;
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true, range })[0] ?? [];
}

async function main(): Promise<number> {
  const options = parseOptions(process.argv.slice(2));
  if (!options.file || !existsSync(options.file)) {
    console.error('Usage: npx tsx scripts/db/load-icd10-mit.ts <MIT .xlsx file> [--source "SA MIT 2021"] [--dry-run]');
    return 2;
  }

  const workbook = XLSX.read(readFileSync(options.file), { type: 'buffer' });
  const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904);
  const sheetName = workbook.SheetNames.find(name => isMitHeader(firstRow(workbook.Sheets[name])));
  if (!sheetName) {
    console.error('No sheet in the file has the MIT column headings (ICD10_Code, WHO_Full_Desc, Valid_ICD10_ClinicalUse, ...).');
    return 1;
  }
  const source = options.source ?? mitSourceName(sheetName, basename(options.file));
  if (!source) {
    console.error('Name the list with --source, for example --source "SA MIT 2021".');
    return 2;
  }

  const [header, ...rows] = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: null, raw: true });
  const mapped = mapMitRows(header ?? [], rows, { source, date1904 });
  console.log(
    `Sheet "${sheetName}" (${date1904 ? '1904' : '1900'} date system): ${mapped.rows.length} codes read, ` +
      `${mapped.blankRows} blank rows skipped, ${mapped.tidiedFlags} flags tidied (lower case or spaces).`
  );
  if (mapped.errors.length > 0) {
    console.error(`${mapped.errors.length} problems found, nothing loaded:`);
    mapped.errors.slice(0, MAX_ERRORS_SHOWN).forEach(message => console.error(`  ${message}`));
    if (mapped.errors.length > MAX_ERRORS_SHOWN) console.error(`  ... and ${mapped.errors.length - MAX_ERRORS_SHOWN} more.`);
    return 1;
  }
  if (options.dryRun) {
    console.log(`Dry run: ${mapped.rows.length} codes would be loaded as "${source}".`);
    return 0;
  }

  config({ path: resolve(process.cwd(), '.env') });
  const url = process.env.VITE_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) {
    console.error('VITE_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env (run the script from the repository folder).');
    return 2;
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const loadedAt = new Date().toISOString();
  const batches = inBatches(mapped.rows, BATCH_SIZE);
  for (const [number, batch] of batches.entries()) {
    const { error } = await db.from('icd10_codes').upsert(batch.map(row => ({ ...row, loaded_at: loadedAt })), { onConflict: 'code' });
    if (error) {
      console.error(`Batch ${number + 1} of ${batches.length} failed (${error.code ?? 'no code'}): ${error.message}. The batches before it were loaded; run the script again.`);
      return 3;
    }
  }

  const countRows = async (fromSource?: string): Promise<number> => {
    let query = db.from('icd10_codes').select('code', { count: 'exact', head: true });
    if (fromSource) query = query.eq('source', fromSource);
    const { count, error } = await query;
    if (error) throw new Error(error.message);
    return count ?? 0;
  };
  const total = await countRows();
  const fromThisList = await countRows(source);
  console.log(`Upserted ${mapped.rows.length} codes in ${batches.length} batches as "${source}".`);
  console.log(`The table holds ${total} codes: ${fromThisList} from "${source}", ${total - fromThisList} from other lists (not in this file; kept).`);
  return fromThisList === mapped.rows.length ? 0 : 1;
}

main()
  .then(code => process.exit(code))
  .catch(error => {
    console.error(`The load failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exit(3);
  });
