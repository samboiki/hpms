/**
 * Moves the patient and staff records of the public bucket "documents" into the private bucket "records"
 * (proposals/2026-10-08-records-bucket.sql, "Moving the existing files").
 *
 * Run it at release time, once the app version that reads "records" is live: the July 2025 build opens the public
 * links, which stop working for every file this moves.
 *
 *   node scripts/storage/move-records.ts            the plan, in counts; changes nothing
 *   node scripts/storage/move-records.ts --apply    per file: copy, repoint its rows, then delete the public copy
 *
 * Needs, in .env (never in chat or git): SUPABASE_DB_URL and SUPABASE_DB_CA (as scripts/db/rehearse-proposals.ts;
 * --insecure-tls skips the certificate check), SUPABASE_URL or VITE_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY (the
 * copy and the delete go through the Storage API). The plan is scripts/storage/record-moves.sql. Every file is checked
 * before the first copy; the run stops at the first failure, and running it again carries on (a copy already made
 * is reused, never made twice). Prints counts only, never names, paths or ids.
 */
import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { LEGACY_RECORDS_BUCKET, RECORDS_BUCKET } from '../../src/services/recordPaths.ts';
import { moveOne, moveProblem, summarize, type PlannedMove, type RowUpdate } from './recordMoves.ts';

const readEnvFile = (): Record<string, string> => {
  if (!existsSync('.env')) return {};
  return Object.fromEntries(
    readFileSync('.env', 'utf8')
      .split(/\r?\n/)
      .map(line => /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line))
      .filter((match): match is RegExpExecArray => match !== null)
      .map(match => [match[1], match[2].replace(/^["']|["']$/g, '')])
  );
};

async function main(): Promise<number> {
  const apply = process.argv.includes('--apply');
  const insecureTls = process.argv.includes('--insecure-tls');
  const env = { ...readEnvFile(), ...process.env };
  if (!env.SUPABASE_DB_URL) {
    console.error('SUPABASE_DB_URL is not set. Add the Session pooler connection string to .env (never paste it in chat).');
    return 2;
  }
  const ca = env.SUPABASE_DB_CA && existsSync(env.SUPABASE_DB_CA) ? readFileSync(env.SUPABASE_DB_CA, 'utf8') : null;
  if (!ca && !insecureTls) {
    console.error('Set SUPABASE_DB_CA to the Supabase CA certificate file (Database settings > SSL), or pass --insecure-tls.');
    return 2;
  }

  const db = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false } });
  await db.connect();
  try {
    const plan = (await db.query(readFileSync('scripts/storage/record-moves.sql', 'utf8'))).rows as PlannedMove[];
    summarize(plan).forEach(line => console.log(line));

    const problems = plan.map(moveProblem).filter((problem): problem is string => problem !== null);
    if (problems.length > 0) {
      console.error(`\nNothing was changed: ${problems.length} file(s) cannot be moved safely.`);
      [...new Set(problems)].forEach(problem => console.error(`  ${problems.filter(p => p === problem).length} x ${problem}`));
      return 1;
    }
    if (!apply) {
      console.log('\nPlan only: nothing was changed. At release time run it again with --apply.');
      return 0;
    }

    const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      console.error('Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env to copy and delete files.');
      return 2;
    }
    const storage = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
    const io = {
      copy: async (oldPath: string, newPath: string) => {
        const { error } = await storage.from(LEGACY_RECORDS_BUCKET).copy(oldPath, newPath, { destinationBucket: RECORDS_BUCKET });
        if (error) throw new Error(`copy failed: ${error.message}`);
      },
      repoint: async (updates: RowUpdate[]) => {
        await db.query('BEGIN');
        try {
          for (const update of updates) {
            const result = await db.query(update.text, update.values);
            if (result.rowCount !== 1) throw new Error('a row changed since the plan was read');
          }
          await db.query('COMMIT');
        } catch (error) {
          await db.query('ROLLBACK');
          throw error;
        }
      },
      removeOld: async (oldPath: string) => {
        const { error } = await storage.from(LEGACY_RECORDS_BUCKET).remove([oldPath]);
        if (error) throw new Error(`delete of the public copy failed: ${error.message}`);
      }
    };

    let moved = 0;
    for (const move of plan.filter(item => item.new_path)) {
      try {
        await moveOne(move, io);
        moved += 1;
      } catch (error) {
        console.error(`\nStopped after ${moved} file(s): ${error instanceof Error ? error.message : String(error)}. Run it again to carry on.`);
        return 1;
      }
    }
    console.log(`\nMoved ${moved} file(s) into "${RECORDS_BUCKET}" and repointed their rows.`);
    return 0;
  } finally {
    await db.end();
  }
}

main().then(code => process.exit(code), error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
