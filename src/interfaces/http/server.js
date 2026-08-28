'use strict';

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const env = require('../../config/env');
const logger = require('../../infrastructure/logger/logger');
const { buildRoutes } = require('./routes');
const { errorHandler, notFound } = require('./middlewares/errorHandler');

/** Construye la app Express con seguridad, rate limiting y rutas. */
function createApp(container) {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Rate limiting global (protege la API)
  app.use(
    rateLimit({
      windowMs: env.security.rateLimitWindowMs,
      max: env.security.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: { ok: false, error: { code: 'RATE_LIMIT', message: 'Demasiadas solicitudes' } },
    })
  );

  // Log de peticiones
  app.use((req, _res, next) => {
    logger.debug('%s %s', req.method, req.originalUrl);
    next();
  });

  // SPA / componentes del diálogo de pago (comandera / retail)
  app.use(express.static(path.join(__dirname, '..', '..', '..', 'public')));

  app.use('/api', buildRoutes(container));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
