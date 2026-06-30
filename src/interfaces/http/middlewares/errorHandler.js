'use strict';

const { AppError } = require('../../../domain/errors/AppError');
const logger = require('../../../infrastructure/logger/logger');

/** Middleware central de manejo de errores (respuestas consistentes). */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      ok: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
  }
  logger.error({ err: err.message, stack: err.stack }, 'Error no controlado');
  return res.status(500).json({
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' },
  });
}

function notFound(req, res) {
  res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } });
}

module.exports = { errorHandler, notFound };
