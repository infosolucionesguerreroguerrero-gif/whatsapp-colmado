'use strict';

/**
 * Recibo de Ingresos (talonario): documento que respalda dinero recibido de
 * un cliente, aplicado a una o más facturas a crédito (CXC) o como anticipo.
 *
 * Incluye el desglose por formas de pago y el asiento contable generado.
 */

const FORMAS_PAGO = Object.freeze(['efectivo', 'cheque', 'transferencia', 'tarjeta', 'otro']);

const ESTADOS = Object.freeze({ EMITIDO: 'emitido', ANULADO: 'anulado' });

/** Plan de cuentas por defecto para el asiento contable del recibo. */
const CUENTAS_FORMA_PAGO = Object.freeze({
  efectivo: Object.freeze({ cuenta: '1101.01', descripcion: 'Caja General' }),
  cheque: Object.freeze({ cuenta: '1102.01', descripcion: 'Cheques por Depositar' }),
  transferencia: Object.freeze({ cuenta: '1102.02', descripcion: 'Bancos - Transferencias' }),
  tarjeta: Object.freeze({ cuenta: '1103.01', descripcion: 'Tarjetas de Crédito por Cobrar' }),
  otro: Object.freeze({ cuenta: '1105.01', descripcion: 'Otras Formas de Ingreso' }),
});

const CUENTA_CXC = Object.freeze({ cuenta: '1201.01', descripcion: 'Cuentas por Cobrar Clientes' });
const CUENTA_ANTICIPO = Object.freeze({ cuenta: '2102.01', descripcion: 'Anticipos de Clientes' });

class ReciboIngreso {
  constructor({
    numero = null,
    fecha = new Date(),
    codCliente,
    nombreCliente = '',
    concepto = '',
    formasPago = [],
    aplicaciones = [],
    montoLetras = '',
    estado = ESTADOS.EMITIDO,
    usuario = null,
    asiento = null,
  }) {
    this.numero = numero;
    this.fecha = fecha;
    this.codCliente = codCliente;
    this.nombreCliente = nombreCliente;
    this.concepto = concepto;
    this.formasPago = formasPago;
    this.aplicaciones = aplicaciones;
    this.montoLetras = montoLetras;
    this.estado = estado;
    this.usuario = usuario;
    this.asiento = asiento;
  }

  get totalRecibido() {
    return this.formasPago.reduce((acc, p) => acc + Number(p.monto || 0), 0);
  }

  get totalAplicado() {
    return this.aplicaciones.reduce((acc, a) => acc + Number(a.montoAplicado || 0), 0);
  }

  /** Monto recibido que no se aplicó a facturas (queda como anticipo). */
  get saldoFavor() {
    const s = this.totalRecibido - this.totalAplicado;
    return s > 0 ? s : 0;
  }

  toJSON() {
    return {
      numero: this.numero,
      fecha: this.fecha,
      codCliente: this.codCliente,
      nombreCliente: this.nombreCliente,
      concepto: this.concepto,
      formasPago: this.formasPago,
      aplicaciones: this.aplicaciones,
      montoLetras: this.montoLetras,
      estado: this.estado,
      usuario: this.usuario,
      asiento: this.asiento,
      totalRecibido: this.totalRecibido,
      totalAplicado: this.totalAplicado,
      saldoFavor: this.saldoFavor,
    };
  }
}

ReciboIngreso.FORMAS_PAGO = FORMAS_PAGO;
ReciboIngreso.ESTADOS = ESTADOS;
ReciboIngreso.CUENTAS_FORMA_PAGO = CUENTAS_FORMA_PAGO;
ReciboIngreso.CUENTA_CXC = CUENTA_CXC;
ReciboIngreso.CUENTA_ANTICIPO = CUENTA_ANTICIPO;

module.exports = ReciboIngreso;
