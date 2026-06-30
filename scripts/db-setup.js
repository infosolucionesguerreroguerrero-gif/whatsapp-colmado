'use strict';

/**
 * Ejecuta los scripts SQL en orden contra SQL Server para crear la base de
 * datos completa (esquema, índices, vistas, SPs, triggers y seed).
 *
 * Uso:
 *   node scripts/db-setup.js            # ejecuta todos los scripts
 *   node scripts/db-setup.js --seed-only # solo 06_seed.sql
 *
 * Requiere DB_DRIVER=mssql y credenciales válidas en .env.
 */
const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const env = require('../src/config/env');

const SQL_DIR = path.join(__dirname, '..', 'sql');

async function run() {
  const seedOnly = process.argv.includes('--seed-only');
  const files = seedOnly
    ? ['06_seed.sql']
    : ['01_schema.sql', '02_indexes.sql', '03_views.sql', '04_stored_procedures.sql', '05_triggers.sql', '06_seed.sql'];

  // Conexión inicial sin base de datos específica (para poder crearla)
  const pool = await sql.connect({
    server: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: seedOnly ? env.db.database : 'master',
    options: { encrypt: env.db.encrypt, trustServerCertificate: env.db.trustServerCertificate, enableArithAbort: true },
  });

  for (const file of files) {
    const fullPath = path.join(SQL_DIR, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    // mssql no soporta GO; dividimos por GO en líneas propias
    const batches = content.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
    console.log(`\n=== Ejecutando ${file} (${batches.length} lotes) ===`);
    for (const batch of batches) {
      await pool.request().batch(batch);
    }
    console.log(`✓ ${file} completado`);
  }

  await pool.close();
  console.log('\n✅ Base de datos lista.');
}

run().catch((err) => {
  console.error('❌ Error configurando la base de datos:', err.message);
  process.exit(1);
});
