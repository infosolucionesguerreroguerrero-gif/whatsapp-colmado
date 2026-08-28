'use strict';

const asyncHandler = require('../middlewares/asyncHandler');

/**
 * Controlador REST de Cuentas por Cobrar Clientes.
 *
 * Equivalente a la forma Delphi UFacXCob: consulta, filtrado por antigüedad,
 * resumen por cliente y exportación básica a Excel/JSON.
 */
class CuentasPorCobrarController {
  constructor({ cuentasPorCobrarService }) {
    this.service = cuentasPorCobrarService;

    this.listar = asyncHandler(async (req, res) => {
      const data = await this.service.listar(this._filtro(req.query));
      res.json({ ok: true, data });
    });

    this.resumenCliente = asyncHandler(async (req, res) => {
      const { codigo } = req.params;
      const data = await this.service.resumenPorCliente(codigo);
      res.json({ ok: true, data });
    });

    this.porAntiguedad = asyncHandler(async (req, res) => {
      const { min, max } = req.params;
      const filtro = this._filtro(req.query);
      const data = await this.service.filtrarPorDias(Number(min), Number(max), filtro);
      res.json({ ok: true, data });
    });

    this.exportarExcel = asyncHandler(async (req, res) => {
      const { facturas } = await this.service.listar(this._filtro(req.query));
      const rows = this.service.exportarExcel(facturas);
      res.json({ ok: true, data: rows });
    });

    this.actualizar = asyncHandler(async (req, res) => {
      const data = await this.service.actualizar();
      res.json({ ok: true, data });
    });
  }

  _filtro(query) {
    const filtro = {};
    if (query.codCliente) filtro.codCliente = query.codCliente;
    if (query.vendedor) filtro.vendedor = query.vendedor;
    if (query.fechaDesde) filtro.fechaDesde = query.fechaDesde;
    if (query.fechaHasta) filtro.fechaHasta = query.fechaHasta;
    if (query.orden) filtro.orden = query.orden;
    if (query.formaPago) filtro.formaPago = query.formaPago;
    return filtro;
  }
}

module.exports = CuentasPorCobrarController;
