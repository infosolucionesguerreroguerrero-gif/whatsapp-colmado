'use strict';

require('dotenv').config();

/**
 * Carga y normaliza la configuración desde variables de entorno.
 * Centraliza el acceso a `process.env` (un único punto de verdad).
 */
function bool(value, def = false) {
  if (value === undefined || value === null || value === '') return def;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).toLowerCase());
}

function num(value, def) {
  const n = Number(value);
  return Number.isFinite(n) ? n : def;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 3000),
  wsPort: num(process.env.WS_PORT, 3001),
  logLevel: process.env.LOG_LEVEL || 'info',

  security: {
    jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
    rateLimitWindowMs: num(process.env.RATE_LIMIT_WINDOW_MS, 60000),
    rateLimitMax: num(process.env.RATE_LIMIT_MAX, 120),
  },

  db: {
    driver: (process.env.DB_DRIVER || 'memory').toLowerCase(), // mssql | memory
    host: process.env.DB_HOST || 'localhost',
    port: num(process.env.DB_PORT, 1433),
    database: process.env.DB_NAME || 'ColmadoDB',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    encrypt: bool(process.env.DB_ENCRYPT, false),
    trustServerCertificate: bool(process.env.DB_TRUST_SERVER_CERTIFICATE, true),
    poolMax: num(process.env.DB_POOL_MAX, 10),
    poolMin: num(process.env.DB_POOL_MIN, 0),
    cxcSchema: process.env.CXC_SCHEMA || 'auto',
  },

  whatsapp: {
    provider: (process.env.WHATSAPP_PROVIDER || 'console').toLowerCase(), // baileys | cloud | console
    baileysAuthDir: process.env.BAILEYS_AUTH_DIR || './auth_info_baileys',
    cloud: {
      token: process.env.WHATSAPP_CLOUD_TOKEN || '',
      phoneNumberId: process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID || '',
      verifyToken: process.env.WHATSAPP_CLOUD_VERIFY_TOKEN || 'mi_verify_token',
      apiVersion: process.env.WHATSAPP_CLOUD_API_VERSION || 'v20.0',
    },
  },

  ai: {
    provider: (process.env.AI_PROVIDER || 'rules').toLowerCase(), // rules | openai
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    enableVoice: bool(process.env.AI_ENABLE_VOICE, false),
    enableImage: bool(process.env.AI_ENABLE_IMAGE, false),
  },

  printer: {
    driver: (process.env.PRINTER_DRIVER || 'file').toLowerCase(), // network | file | noop
    host: process.env.PRINTER_HOST || '192.168.1.50',
    port: num(process.env.PRINTER_PORT, 9100),
    width: num(process.env.PRINTER_WIDTH, 42),
    outputDir: process.env.PRINTER_OUTPUT_DIR || './tickets',
  },

  business: {
    name: process.env.BUSINESS_NAME || 'COLMADO LA ESPERANZA',
    phone: process.env.BUSINESS_PHONE || '809-000-0000',
    address: process.env.BUSINESS_ADDRESS || 'Calle Principal #1',
    currency: process.env.CURRENCY || 'RD$',
    itbisRate: num(process.env.ITBIS_RATE, 0),
    deliveryFee: num(process.env.DEFAULT_DELIVERY_FEE, 100),
  },
};

module.exports = env;
