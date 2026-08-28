'use strict';

const { round2 } = require('../value-objects/Money');

/** Estados del pedido (alineados con la tabla EstadosPedidos). */
const ESTADOS = Object.freeze({
  RECIBIDO: 1,
  CONFIRMADO: 2,
  PREPARANDO: 3,
  ENVIADO: 4,
  ENTREGADO: 5,
  CANCELADO: 6,
});

const ESTADO_NOMBRE = Object.freeze({
  1: 'Recibido',
  2: 'Confirmado',
  3: 'Preparando',
  4: 'Enviado',
  5: 'Entregado',
  6: 'Cancelado',
});

const FORMAS_PAGO = Object.freeze(['efectivo', 'transferencia', 'tarjeta', 'contraentrega']);

/** Entidad de dominio: Pedido confirmado. */
class Pedido {
  constructor({
    pedidoId = null,
    clienteId,
    direccionId = null,
    estadoId = ESTADOS.RECIBIDO,
    items = [],
    subtotal = 0,
    envio = 0,
    itbis = 0,
    total = 0,
    formaPago = null,
    notas = null,
    tiempoEstimadoMin = null,
    cliente = null,
    creado = null,
    pagos = [],
    cargoTC = 0,
  } = {}) {
    this.pedidoId = pedidoId;
    this.clienteId = clienteId;
    this.direccionId = direccionId;
    this.estadoId = estadoId;
    this.items = items;
    this.subtotal = Number(subtotal);
    this.envio = Number(envio);
    this.itbis = Number(itbis);
    this.total = Number(total);
    this.formaPago = formaPago;
    this.notas = notas;
    this.tiempoEstimadoMin = tiempoEstimadoMin;
    this.cliente = cliente;
    this.creado = creado;
    this.pagos = pagos;
    this.cargoTC = Number(cargoTC || 0);
  }

  get totalConCargo() {
    return round2(this.total + this.cargoTC);
  }

  get estadoNombre() {
    return ESTADO_NOMBRE[this.estadoId] || 'Desconocido';
  }
}

Pedido.ESTADOS = ESTADOS;
Pedido.ESTADO_NOMBRE = ESTADO_NOMBRE;
Pedido.FORMAS_PAGO = FORMAS_PAGO;

module.exports = Pedido;
