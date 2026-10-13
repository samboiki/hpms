/**
 * Rehearses the SQL proposals against the real database WITHOUT changing it.
 *
 * Every file runs in order inside ONE transaction, each behind a savepoint: later files see what earlier ones
 * created, and a file that fails is reported (and undone) without stopping the rest. At the end the transaction is
 * rolled back, so nothing is kept. With --commit nothing is kept unless EVERY file succeeded (all or nothing).
 * Locks wait at most 5 seconds and statements at most 2 minutes, so a rehearsal never holds up the live app for long;
 * still, run it at a quiet hour.
 *
 * Needs SUPABASE_DB_URL (Supabase > Connect > Session pooler connection string, which holds the database password: put
 * it in .env, never in chat or git) and the Supabase CA certificate for TLS (Database settings > SSL > download) in
 * SUPABASE_DB_CA. --insecure-tls skips certificate checking and should only be used if downloading it is impossible.
 * Result rows are never printed (only counts), and NOTICE text is masked for emails and long numbers.
 *
 *   node scripts/db/rehearse-proposals.ts                     rehearse the default order (rehearsal.ts), roll back
 *   node scripts/db/rehearse-proposals.ts proposals/x.sql     rehearse chosen files
 *   node scripts/db/rehearse-proposals.ts --commit            apply, only if every file succeeds
 */
import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';
import { maskPersonalData, parseArgs, psqlMetaCommandLines, stripTransactionControl } from './rehearsal.ts';

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

interface FileResult {
  file: string;
  status: 'ok' | 'failed' | 'missing' | 'skipped';
  detail: string;
  notices: string[];
  ms: number;
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  const env = { ...readEnvFile(), ...process.env };
  const connectionString = env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error('SUPABASE_DB_URL is not set. Add the Session pooler connection string to .env (never paste it in chat).');
    return 2;
  }
  const ca = env.SUPABASE_DB_CA && existsSync(env.SUPABASE_DB_CA) ? readFileSync(env.SUPABASE_DB_CA, 'utf8') : null;
  if (!ca && !options.insecureTls) {
    console.error('Set SUPABASE_DB_CA to the Supabase CA certificate file (Database settings > SSL), or pass --insecure-tls.');
    return 2;
  }

  const client = new pg.Client({ connectionString, ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false } });
  const results: FileResult[] = [];
  let current: FileResult | null = null;
  client.on('notice', notice => {
    if (current) current.notices.push(maskPersonalData(`${notice.severity ?? 'NOTICE'}: ${notice.message ?? ''}`));
  });

  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '120s'");
    for (const [index, file] of options.files.entries()) {
      if (!existsSync(file)) {
        results.push({ file, status: 'missing', detail: 'file not found (not written yet?)', notices: [], ms: 0 });
        continue;
      }
      const sql = readFileSync(file, 'utf8');
      const metaLines = psqlMetaCommandLines(sql);
      if (metaLines.length > 0) {
        results.push({ file, status: 'skipped', detail: `psql-only commands on lines ${metaLines.join(', ')}`, notices: [], ms: 0 });
        continue;
      }
      current = { file, status: 'ok', detail: '', notices: [], ms: 0 };
      const started = Date.now();
      await client.query(`SAVEPOINT file_${index}`);
      try {
        const response = await client.query(stripTransactionControl(sql));
        const responses = Array.isArray(response) ? response : [response];
        current.detail = `${responses.length} statement(s), ${responses.reduce((sum, item) => sum + (item.rowCount ?? 0), 0)} row(s) touched or returned`;
        await client.query(`RELEASE SAVEPOINT file_${index}`);
      } catch (error) {
        const failure = error as { message?: string; position?: string; where?: string };
        current.status = 'failed';
        current.detail = maskPersonalData(`${failure.message ?? String(error)}${failure.where ? ` (${failure.where.split('\n')[0]})` : ''}`);
        await client.query(`ROLLBACK TO SAVEPOINT file_${index}`);
      }
      current.ms = Date.now() - started;
      results.push(current);
      current = null;
    }

    const failed = results.filter(result => result.status === 'failed' || result.status === 'skipped');
    if (options.commit && failed.length === 0) {
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }

    for (const result of results) {
      console.log(`${result.status.toUpperCase().padEnd(8)} ${result.file}  ${result.detail}${result.ms ? `  (${result.ms} ms)` : ''}`);
      result.notices.slice(0, 40).forEach(notice => console.log(`           ${notice}`));
      if (result.notices.length > 40) console.log(`           ... ${result.notices.length - 40} more notices`);
    }
    const committed = options.commit && failed.length === 0;
    console.log(committed ? '\nCOMMITTED: every file succeeded and was applied.' : `\nROLLED BACK: nothing was changed.${options.commit ? ` Not applied because ${failed.length} file(s) failed.` : ''}`);
    return failed.length === 0 ? 0 : 1;
  } finally {
    await client.end();
  }
}

main().then(code => process.exit(code), error => {
  console.error(maskPersonalData(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
