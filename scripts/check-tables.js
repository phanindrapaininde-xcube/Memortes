const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const client = new Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

client.connect()
  .then(() => client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"))
  .then(r => {
    console.log(`\nTables in Supabase (${r.rows.length} total):\n`);
    r.rows.forEach(row => console.log(`  ✅  ${row.tablename}`));
    console.log('');
    return client.end();
  })
  .catch(e => { console.error(e.message); client.end(); });
