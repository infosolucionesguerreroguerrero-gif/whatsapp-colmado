'use strict';

const { PedidoDTO } = require('../../../application/dto');

/**
 * Controlador REST del diálogo de pago: formas de pago, monedas,
 * cálculo de cambio, procesamiento y facturación electrónica.
 */
class PagoController {
  constructor({ pagoService }) {
    this.svc = pagoService;
  }

  async formasPago(_req, res, next) {
    try {
      const formas = await this.svc.obtenerFormasPago();
      res.json({ ok: true, data: formas });
    } catch (err) {
      next(err);
    }
  }

  async monedas(_req, res, next) {
    try {
      const monedas = await this.svc.obtenerMonedas();
      res.json({ ok: true, data: monedas });
    } catch (err) {
      next(err);
    }
  }

  async calcular(req, res, next) {
    try {
      const { pedidoId } = req.params;
      const { lineas, cargoTC } = req.body;
      const resultado = await this.svc.calcular(Number(pedidoId), { lineas, cargoTC });
      res.json({ ok: true, data: resultado });
    } catch (err) {
      next(err);
    }
  }

  async procesar(req, res, next) {
    try {
      const { pedidoId } = req.params;
      const { lineas = [], rncComprador = null, generarFe = false, cargoTC = null } = req.body;
      const resultado = await this.svc.procesar(Number(pedidoId), {
        lineas,
        rncComprador,
        generarFe: Boolean(generarFe),
        cargoTC,
      });
      res.json({ ok: true, data: { ...resultado, pedido: PedidoDTO.from(resultado.pedido) } });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = PagoController;
