/**
 * Resets and migrates the Supabase database.
 * Uses postgres.js which natively handles multi-statement SQL files
 * including $$ dollar-quoted PL/pgSQL functions.
 *
 * Usage: node scripts/migrate.js
 */

const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

// ── Load .env ─────────────────────────────────────────────────
const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

if (!env.DATABASE_URL) {
  console.error('❌  DATABASE_URL not set in .env');
  process.exit(1);
}

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

async function migrate() {
  const sql = postgres(env.DATABASE_URL, {
    ssl: 'require',
    max: 1,
    onnotice: () => {},
  });

  // ── Drop all public tables for a clean slate ─────────────────
  console.log('🗑️   Dropping existing public tables...');
  const tables = await sql`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  if (tables.length > 0) {
    const names = tables.map(r => r.tablename).join(', ');
    await sql.unsafe(`DROP TABLE IF EXISTS ${tables.map(r => `public.${r.tablename}`).join(', ')} CASCADE`);
    console.log(`   Dropped: ${names}`);
  } else {
    console.log('   No existing tables.');
  }

  // ── Drop custom enum types ────────────────────────────────────
  console.log('🗑️   Dropping custom enum types...');
  const types = await sql`
    SELECT typname FROM pg_type
    WHERE typtype = 'e'
      AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  `;
  for (const t of types) {
    await sql.unsafe(`DROP TYPE IF EXISTS public.${t.typname} CASCADE`);
  }
  if (types.length > 0) console.log(`   Dropped: ${types.map(t => t.typname).join(', ')}`);
  else console.log('   No custom types.');

  // ── Run each migration file ───────────────────────────────────
  console.log(`\n📂  Running ${files.length} migration(s):\n`);
  for (const file of files) {
    process.stdout.write(`▶  ${file} ... `);
    const filePath = path.join(migrationsDir, file);
    try {
      await sql.file(filePath);
      console.log('✅');
    } catch (err) {
      console.log('❌');
      console.error(`   ${err.message}\n`);
      await sql.end();
      process.exit(1);
    }
  }

  await sql.end();

  // ── Verify ────────────────────────────────────────────────────
  const sql2 = postgres(env.DATABASE_URL, { ssl: 'require', max: 1 });
  const result = await sql2`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  console.log(`\n✅  Tables created (${result.length} total):\n`);
  result.forEach(r => console.log(`   • ${r.tablename}`));
  await sql2.end();

  console.log('\n🎉  Migration complete!\n');
}

migrate().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
