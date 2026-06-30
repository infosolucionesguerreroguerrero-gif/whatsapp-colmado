'use strict';

const asyncHandler = require('../middlewares/asyncHandler');

/** Controlador HTTP para (re)imprimir un pedido en la impresora térmica. */
class ImpresionController {
  constructor({ pedidoService }) {
    this.pedidos = pedidoService;

    this.imprimir = asyncHandler(async (req, res) => {
      const resultado = await this.pedidos.reimprimir(Number(req.body.pedidoId));
      res.json({ ok: true, data: resultado });
    });
  }
}

module.exports = ImpresionController;
