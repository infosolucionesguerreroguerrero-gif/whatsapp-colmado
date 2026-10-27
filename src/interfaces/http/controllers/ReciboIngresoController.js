'use strict';

const asyncHandler = require('../middlewares/asyncHandler');

/**
 * Controlador REST del Recibo de Ingresos (talonario).
 * Emisión de recibos por cobros a clientes, con desglose por formas de pago
 * y asiento contable generado automáticamente.
 */
class ReciboIngresoController {
  constructor({ reciboIngresoService }) {
    this.service = reciboIngresoService;

    this.listar = asyncHandler(async (req, res) => {
      const filtro = {};
      if (req.query.codCliente) filtro.codCliente = req.query.codCliente;
      if (req.query.fechaDesde) filtro.fechaDesde = req.query.fechaDesde;
      if (req.query.fechaHasta) filtro.fechaHasta = req.query.fechaHasta;
      const data = await this.service.listar(filtro);
      res.json({ ok: true, data });
    });

    this.obtener = asyncHandler(async (req, res) => {
      const data = await this.service.obtener(req.params.numero);
      res.json({ ok: true, data });
    });

    this.crear = asyncHandler(async (req, res) => {
      const data = await this.service.crear(req.body);
      res.status(201).json({ ok: true, data });
    });

    this.anular = asyncHandler(async (req, res) => {
      const data = await this.service.anular(req.params.numero);
      res.json({ ok: true, data });
    });

    this.formasPago = asyncHandler(async (_req, res) => {
      const b = this.service.business || {};
      res.json({
        ok: true,
        data: {
          formasPago: this.service.catalogoFormasPago(),
          empresa: {
            nombre: b.name || '',
            rnc: b.rnc || '',
            telefono: b.phone || '',
            direccion: b.address || '',
            moneda: b.currency || 'RD$',
          },
        },
      });
    });
  }
}

module.exports = ReciboIngresoController;
