'use strict';

const jwt = require('jsonwebtoken');
const env = require('../../../config/env');
const { UnauthorizedError } = require('../../../domain/errors/AppError');

/** Genera un token JWT (usado por el endpoint de login). */
function signToken(payload) {
  return jwt.sign(payload, env.security.jwtSecret, { expiresIn: env.security.jwtExpiresIn });
}

/** Middleware que exige un JWT válido en Authorization: Bearer <token>. */
function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new UnauthorizedError('Falta el token de autenticación'));
  try {
    req.user = jwt.verify(token, env.security.jwtSecret);
    return next();
  } catch (_e) {
    return next(new UnauthorizedError('Token inválido o expirado'));
  }
}

module.exports = { signToken, requireAuth };
