'use strict';

const IPedidoRepository = require('../../../../domain/repositories/IPedidoRepository');
const Pedido = require('../../../../domain/entities/Pedido');
const { round2 } = require('../../../../domain/value-objects/Money');

/** Implementación en memoria del repositorio de pedidos (driver "memory"). */
class MemoryPedidoRepository extends IPedidoRepository {
  constructor() {
    super();
    this._pedidos = new Map(); // pedidoId -> data
    this._pagos = new Map(); // pedidoId -> [pagos]
    this._seq = 1000;
  }

  async crear({ clienteId, direccionId = null, items, envio = 0, itbisRate = 0, formaPago = null, notas = null, cliente = null }) {
    const subtotal = round2(items.reduce((acc, i) => acc + Number(i.cantidad) * Number(i.precioUnit), 0));
    const itbis = round2(subtotal * itbisRate);
    const total = round2(subtotal + envio + itbis);
    const pedidoId = ++this._seq;
    const data = {
      pedidoId,
      clienteId,
      direccionId,
      estadoId: Pedido.ESTADOS.RECIBIDO,
      items: items.map((i) => ({
        productoId: i.productoId,
        descripcion: i.descripcion,
        cantidad: Number(i.cantidad),
        precioUnit: Number(i.precioUnit),
        importe: round2(Number(i.cantidad) * Number(i.precioUnit)),
      })),
      subtotal,
      envio,
      itbis,
      total,
      formaPago,
      notas,
      tiempoEstimadoMin: 20,
      cliente,
      creado: new Date().toISOString(),
    };
    this._pedidos.set(pedidoId, data);
    return new Pedido(_clone(data));
  }

  async getById(pedidoId) {
    const d = this._pedidos.get(Number(pedidoId));
    if (!d) return null;
    const data = _clone(d);
    data.pagos = _clone(this._pagos.get(Number(pedidoId)) || []);
    return new Pedido(data);
  }

  async cambiarEstado(pedidoId, estadoId) {
    const d = this._pedidos.get(Number(pedidoId));
    if (!d) return null;
    d.estadoId = Number(estadoId);
    return this.getById(pedidoId);
  }

  async actualizarFormaPago(pedidoId, formaPago) {
    const d = this._pedidos.get(Number(pedidoId));
    if (!d) return null;
    d.formaPago = formaPago;
    return this.getById(pedidoId);
  }

  async ultimoDeCliente(clienteId) {
    const lista = [...this._pedidos.values()]
      .filter((p) => p.clienteId === Number(clienteId))
      .sort((a, b) => new Date(b.creado) - new Date(a.creado));
    return lista[0] ? this.getById(lista[0].pedidoId) : null;
  }

  async registrarPago(pedidoId, { metodo, monto, referencia = null, estado = 'pendiente', moneda = null, montoMoneda = null, tasa = null, prima = null }) {
    const arr = this._pagos.get(Number(pedidoId)) || [];
    const pago = {
      pagoId: arr.length + 1,
      pedidoId: Number(pedidoId),
      metodo,
      monto: round2(monto),
      referencia,
      estado,
      moneda,
      montoMoneda: montoMoneda != null ? round2(montoMoneda) : null,
      tasa,
      prima,
    };
    arr.push(pago);
    this._pagos.set(Number(pedidoId), arr);
    return pago;
  }

  async list(filtro = {}) {
    let lista = [...this._pedidos.values()];
    if (filtro.estadoId) lista = lista.filter((p) => p.estadoId === Number(filtro.estadoId));
    if (filtro.clienteId) lista = lista.filter((p) => p.clienteId === Number(filtro.clienteId));
    return lista
      .sort((a, b) => new Date(b.creado) - new Date(a.creado))
      .map((d) => this.getById(d.pedidoId));
  }
}

function _clone(o) {
  return JSON.parse(JSON.stringify(o));
}

module.exports = MemoryPedidoRepository;
