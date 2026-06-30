'use strict';

const asyncHandler = require('../middlewares/asyncHandler');
const { signToken } = require('../middlewares/auth');
const { UnauthorizedError } = require('../../../domain/errors/AppError');

/**
 * Controlador de autenticación para el panel administrativo.
 * Demo: credenciales admin/admin (sustituir por tabla de usuarios en producción).
 */
class AuthController {
  constructor() {
    this.login = asyncHandler(async (req, res) => {
      const { usuario, password } = req.body;
      const adminUser = process.env.ADMIN_USER || 'admin';
      const adminPass = process.env.ADMIN_PASSWORD || 'admin';
      if (usuario !== adminUser || password !== adminPass) {
        throw new UnauthorizedError('Credenciales inválidas');
      }
      const token = signToken({ sub: usuario, role: 'admin' });
      res.json({ ok: true, data: { token } });
    });
  }
}

module.exports = AuthController;
