'use strict';

/**
 * Error de aplicación con código HTTP. Las capas superiores (controllers,
 * middleware de errores) lo usan para responder de forma consistente.
 */
class AppError extends Error {
  constructor(message, statusCode = 400, code = 'APP_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado', details = null) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Datos inválidos', details = null) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'No autorizado', details = null) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflicto', details = null) {
    super(message, 409, 'CONFLICT', details);
  }
}

module.exports = { AppError, NotFoundError, ValidationError, UnauthorizedError, ConflictError };
