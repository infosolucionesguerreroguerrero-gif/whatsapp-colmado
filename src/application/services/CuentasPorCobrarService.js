'use strict';

const { ValidationError } = require('../../domain/errors/AppError');

/**
 * Casos de uso de Cuentas por Cobrar Clientes.
 *
 * Traduce la lógica de la forma Delphi UFacXCob.pas al dominio del sistema.
 * Soporta consulta general/filtrada, totales por rangos de antigüedad y
 * exportación básica de datos.
 */
class CuentasPorCobrarService {
  constructor({ cuentasPorCobrarRepository, business }) {
    this.repo = cuentasPorCobrarRepository;
    this.currency = business?.currency || 'RD$';
  }

  _ensureRepo() {
    if (!this.repo) {
      throw new Error('CuentasPorCobrarService requiere DB_DRIVER=mssql y tablas legacy (fac_enca, pagosfacturas, clientes)');
    }
  }

  /**
   * Lista facturas a crédito aplicando filtros.
   * @param {Object} filtro
   * @param {string} [filtro.codCliente]
   * @param {string} [filtro.vendedor]
   * @param {string} [filtro.fechaDesde]
   * @param {string} [filtro.fechaHasta]
   * @param {number} [filtro.diasMin]
   * @param {number} [filtro.diasMax]
   * @param {string} [filtro.orden] codigo|nombre|fecha|factura|tipo
   * @param {string} [filtro.formaPago]
   */
  async listar(filtro = {}) {
    this._ensureRepo();
    if (filtro.fechaDesde && filtro.fechaHasta && new Date(filtro.fechaDesde) > new Date(filtro.fechaHasta)) {
      throw new ValidationError('La fecha inicial no puede ser mayor que la fecha final');
    }

    const facturas = await this.repo.listarFacturas(filtro);
    const resumen = this._calcularResumen(facturas);

    return { facturas, resumen };
  }

  /** Resumen de un cliente específico. */
  async resumenPorCliente(codCliente) {
    this._ensureRepo();
    const { facturas, resumen } = await this.listar({ codCliente });
    const balanceTotal = await this.repo.balancePorCliente(codCliente);
    const cliente = await this.repo.obtenerCliente(codCliente);
    return { cliente, facturas, resumen, balanceTotal };
  }

  /** Filtra por rango de días de antigüedad (equivalente a BUSCAXCOLOR). */
  async filtrarPorDias(diasMin, diasMax, filtro = {}) {
    return this.listar({ ...filtro, diasMin, diasMax });
  }

  /** Recalcula días vencidos y devuelve facturas con totales actualizados. */
  async actualizar() {
    const { facturas, resumen } = await this.listar();
    return { facturas, resumen };
  }

  /** Exporta la lista a formato plano apto para Excel. */
  exportarExcel(facturas) {
    return facturas.map((f) => ({
      Factura: f.nroFact,
      Fecha: f.fechaFact,
      Codigo: f.codCliente,
      Nombre: f.nombreCliente,
      'Monto Bruto': f.montoTotal,
      Descuento: f.descuento,
      ITBIS: f.itebis,
      Neto: f.neto,
      Balance: f.balFact,
    }));
  }

  _calcularResumen(facturas) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const totales = {
      totalXCobrar: 0,
      a14: 0,
      a15: 0,
      a30: 0,
      a45: 0,
      a60: 0,
      a90: 0,
      totalVencido: 0,
    };

    for (const f of facturas) {
      const bal = Number(f.balFact) || 0;
      totales.totalXCobrar += bal;

      const dias = f.diasVencido != null ? f.diasVencido : this._diasVencido(f.fechaFact);
      f.diasVencido = dias;

      if (dias >= 1 && dias <= 14) totales.a14 += bal;
      else if (dias >= 15 && dias <= 29) totales.a15 += bal;
      else if (dias >= 30 && dias <= 44) totales.a30 += bal;
      else if (dias >= 45 && dias <= 59) totales.a45 += bal;
      else if (dias >= 60 && dias <= 89) totales.a60 += bal;
      else if (dias >= 90) totales.a90 += bal;

      if (dias > 0) totales.totalVencido += bal;
    }

    return {
      totalXCobrar: this._fmt(totales.totalXCobrar),
      totalVencido: this._fmt(totales.totalVencido),
      a14: this._fmt(totales.a14),
      a15: this._fmt(totales.a15),
      a30: this._fmt(totales.a30),
      a45: this._fmt(totales.a45),
      a60: this._fmt(totales.a60),
      a90: this._fmt(totales.a90),
      totalA15a90: this._fmt(totales.a15 + totales.a30 + totales.a45 + totales.a60 + totales.a90),
      currency: this.currency,
    };
  }

  _diasVencido(fechaFact) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fec = new Date(fechaFact);
    fec.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((hoy - fec) / (1000 * 60 * 60 * 24)));
  }

  _fmt(value) {
    return Number(value).toLocaleString('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 });
  }
}

module.exports = CuentasPorCobrarService;
