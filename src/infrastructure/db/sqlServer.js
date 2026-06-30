'use strict';

const sql = require('mssql');
const env = require('../../config/env');
const logger = require('../logger/logger');

let pool = null;

/**
 * Devuelve un pool de conexiones a SQL Server (singleton). Reutiliza el pool
 * para todas las consultas. Lanza error si la conexión falla.
 */
async function getPool() {
  if (pool && pool.connected) return pool;

  const config = {
    server: env.db.host,
    port: env.db.port,
    database: env.db.database,
    user: env.db.user,
    password: env.db.password,
    pool: { max: env.db.poolMax, min: env.db.poolMin, idleTimeoutMillis: 30000 },
    options: {
      encrypt: env.db.encrypt,
      trustServerCertificate: env.db.trustServerCertificate,
      enableArithAbort: true,
    },
  };

  pool = new sql.ConnectionPool(config);
  pool.on('error', (err) => logger.error({ err }, 'Error en el pool de SQL Server'));
  await pool.connect();
  logger.info('Conectado a SQL Server (%s/%s)', env.db.host, env.db.database);
  return pool;
}

async function closePool() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

module.exports = { sql, getPool, closePool };
