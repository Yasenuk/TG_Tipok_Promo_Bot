/**
 * Діагностика підключення: npm run check:db
 */
import { existsSync } from 'node:fs';
import { Client } from 'pg';

if (existsSync('.env')) process.loadEnvFile('.env');

function describe(url: string | undefined, label: string): void {
  if (!url) {
    console.log(`${label}: ❌ не задано`);
    return;
  }

  try {
    const parsed = new URL(url);
    const sslmode = parsed.searchParams.get('sslmode');
    const libpq = parsed.searchParams.get('uselibpqcompat');
    const isNeon = parsed.hostname.includes('neon.tech');
    const isPooled = parsed.hostname.includes('-pooler');

    console.log(`\n${label}`);
    console.log(`  host:     ${parsed.hostname}`);
    console.log(`  database: ${parsed.pathname.slice(1)}`);
    console.log(`  sslmode:  ${sslmode ?? '(не вказано)'}`);
    console.log(`  провайдер: ${isNeon ? `Neon${isPooled ? ' (pooled)' : ' (direct)'}` : 'звичайний Postgres'}`);

    if (isNeon && sslmode === 'require' && libpq !== 'true') {
      console.log(
        `  ⚠️  pg ≥ 8.22 sslmode=require як verify-full`,
      );
    }
  } catch {
    console.log(`${label}: ⚠️ не схоже на валідний URL`);
  }
}

async function ping(url: string, label: string): Promise<void> {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 20_000 });
  const started = Date.now();

  try {
    await client.connect();
    const res = await client.query<{ version: string }>('SELECT version()');
    console.log(`  ✅ ${label}: ${Date.now() - started} мс`);
    console.log(`     ${res.rows[0]?.version.split(',')[0] ?? ''}`);
  } catch (error) {
    console.log(`  ❌ ${label}: ${(error as Error).message}`);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main(): Promise<void> {
  describe(process.env.DATABASE_URL, 'DATABASE_URL (рантайм)');
  describe(process.env.DIRECT_DATABASE_URL, 'DIRECT_DATABASE_URL (міграції)');

  console.log('\nПеревірка звʼязку:');
  if (process.env.DATABASE_URL) await ping(process.env.DATABASE_URL, 'DATABASE_URL');
  if (
    process.env.DIRECT_DATABASE_URL &&
    process.env.DIRECT_DATABASE_URL !== process.env.DATABASE_URL
  ) {
    await ping(process.env.DIRECT_DATABASE_URL, 'DIRECT_DATABASE_URL');
  }
  console.log('');
}

void main();
