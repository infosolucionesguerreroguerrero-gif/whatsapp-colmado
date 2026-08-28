'use strict';

const { ValidationError } = require('../../domain/errors/AppError');

/**
 * Casos de uso de Cuentas por Cobrar Clientes.
 *
 * Traduce la lógica de la forma Delphi UFacXCob.pas al dominio del sistema.
 * Soporta consulta general/filtrada, totales por rangos de antigüedad,
 * colores por vencimiento, registro de abonos y exportación.
 */
class CuentasPorCobrarService {
  constructor({ cuentasPorCobrarRepository, business }) {
    this.repo = cuentasPorCobrarRepository;
    this.currency = business?.currency || 'RD$';
  }

  _ensureRepo() {
    if (!this.repo) {
      throw new Error('CuentasPorCobrarService requiere un repositorio configurado');
    }
  }

  /**
   * Lista facturas a crédito aplicando filtros.
   */
  async listar(filtro = {}) {
    this._ensureRepo();
    this._validarFechas(filtro);

    const facturas = await this.repo.listarFacturas(filtro);
    const resumen = this._calcularResumen(facturas);
    const conColor = facturas.map((f) => ({ ...f, color: this._colorPorDias(f.diasVencido) }));

    return { facturas: conColor, resumen };
  }

  /** Resumen de un cliente específico. */
  async resumenPorCliente(codCliente) {
    this._ensureRepo();
    const { facturas, resumen } = await this.listar({ codCliente });
    const [balanceTotal, cliente] = await Promise.all([
      this.repo.balancePorCliente(codCliente),
      this.repo.obtenerCliente(codCliente),
    ]);
    return { cliente, facturas, resumen, balanceTotal };
  }

  /** Filtra por rango de días de antigüedad (equivalente a BUSCAXCOLOR). */
  async filtrarPorDias(diasMin, diasMax, filtro = {}) {
    this._ensureRepo();
    return this.listar({ ...filtro, diasMin, diasMax });
  }

  /** Recalcula días vencidos y devuelve facturas con totales actualizados. */
  async actualizar() {
    this._ensureRepo();
    return this.listar();
  }

  /** Registra un abono sobre una factura. */
  async registrarAbono(nroFact, { monto, metodo = 'ABONO', referencia = null, fecha = new Date() }) {
    this._ensureRepo();
    if (!nroFact) throw new ValidationError('El número de factura es requerido');
    if (!monto || Number(monto) <= 0) throw new ValidationError('El monto del abono debe ser mayor a cero');
    const abono = await this.repo.registrarAbono(nroFact, { monto, metodo, referencia, fecha });
    const { facturas, resumen } = await this.listar();
    return { abono, facturas, resumen };
  }

  /** Exporta la lista a formato plano apto para Excel/JSON. */
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
      Abono: f.abono,
      Devolucion: f.devolucion,
      DesctoPago: f.desctoPago,
      Balance: f.balFact,
      'Días Vencido': f.diasVencido,
      Color: this._colorPorDias(f.diasVencido).color,
    }));
  }

  /** Devuelve un CSV simple con las columnas del grid. */
  exportarCsv(facturas) {
    const rows = this.exportarExcel(facturas);
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => this._csvCell(r[h])).join(',')),
    ];
    return lines.join('\n');
  }

  _validarFechas(filtro) {
    if (filtro.fechaDesde && filtro.fechaHasta) {
      const d1 = new Date(filtro.fechaDesde);
      const d2 = new Date(filtro.fechaHasta);
      if (d1 > d2) throw new ValidationError('La fecha inicial no puede ser mayor que la fecha final');
    }
  }

  _calcularResumen(facturas) {
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

    const totalA15a90 = totales.a15 + totales.a30 + totales.a45 + totales.a60 + totales.a90;

    return {
      totalXCobrar: this._fmt(totales.totalXCobrar),
      totalVencido: this._fmt(totales.totalVencido),
      a14: this._fmt(totales.a14),
      a15: this._fmt(totales.a15),
      a30: this._fmt(totales.a30),
      a45: this._fmt(totales.a45),
      a60: this._fmt(totales.a60),
      a90: this._fmt(totales.a90),
      totalA15a90: this._fmt(totalA15a90),
      raw: {
        totalXCobrar: totales.totalXCobrar,
        totalVencido: totales.totalVencido,
        a14: totales.a14,
        a15: totales.a15,
        a30: totales.a30,
        a45: totales.a45,
        a60: totales.a60,
        a90: totales.a90,
        totalA15a90,
      },
      currency: this.currency,
    };
  }

  _colorPorDias(dias) {
    if (dias >= 90) return { color: 'red', bg: '#ffcccc' };
    if (dias >= 60) return { color: 'gray', bg: '#e0e0e0' };
    if (dias >= 45) return { color: 'yellow', bg: '#fff9c4' };
    if (dias >= 30) return { color: 'blue', bg: '#cce5ff' };
    if (dias >= 15) return { color: 'green', bg: '#ccffcc' };
    return { color: 'white', bg: '#ffffff' };
  }

  _diasVencido(fechaFact) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fec = new Date(fechaFact);
    fec.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((hoy - fec) / (1000 * 60 * 60 * 24)));
  }

  _fmt(value) {
    return `${this.currency} ${Number(value).toFixed(2)}`;
  }

  _csvCell(value) {
    const s = value == null ? '' : String(value);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }
}

module.exports = CuentasPorCobrarService;
