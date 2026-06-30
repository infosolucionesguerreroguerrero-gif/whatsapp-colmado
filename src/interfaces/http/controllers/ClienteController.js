'use strict';

const asyncHandler = require('../middlewares/asyncHandler');
const { ClienteDTO } = require('../../../application/dto');

/** Controlador HTTP de clientes. */
class ClienteController {
  constructor({ clienteService }) {
    this.clientes = clienteService;

    this.crear = asyncHandler(async (req, res) => {
      const { telefono, nombre, direccion } = req.body;
      let cliente = await this.clientes.actualizarNombre(telefono, nombre);
      if (direccion) {
        cliente = await this.clientes.agregarDireccion(cliente.clienteId, direccion);
      }
      const full = await this.clientes.obtener(telefono);
      res.status(201).json({ ok: true, data: ClienteDTO.from(full || cliente) });
    });

    this.obtener = asyncHandler(async (req, res) => {
      const cliente = await this.clientes.obtener(req.params.telefono);
      if (!cliente) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Cliente no encontrado' } });
      res.json({ ok: true, data: ClienteDTO.from(cliente) });
    });
  }
}

module.exports = ClienteController;
