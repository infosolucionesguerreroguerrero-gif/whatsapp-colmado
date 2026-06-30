'use strict';

const ItemCarrito = require('./ItemCarrito');
const { round2 } = require('../value-objects/Money');

/**
 * Entidad de dominio: carrito de compras temporal de un cliente.
 * Contiene la lógica de agregar/quitar/modificar líneas y calcular totales.
 */
class Carrito {
  constructor({ telefono, items = [], envio = 0, itbisRate = 0 } = {}) {
    this.telefono = telefono;
    /** @type {ItemCarrito[]} */
    this.items = items.map((i) => (i instanceof ItemCarrito ? i : new ItemCarrito(i)));
    this.envio = Number(envio);
    this.itbisRate = Number(itbisRate);
  }

  get vacio() {
    return this.items.length === 0;
  }

  agregar({ productoId, descripcion, cantidad, precioUnit }) {
    const existente = this.items.find((i) => i.productoId === productoId);
    if (existente) {
      existente.cantidad = round2(existente.cantidad + Number(cantidad));
    } else {
      this.items.push(new ItemCarrito({ productoId, descripcion, cantidad, precioUnit }));
    }
    return this;
  }

  /** Reduce la cantidad de un producto; lo elimina si llega a 0. */
  quitar(productoId, cantidad = null) {
    const idx = this.items.findIndex((i) => i.productoId === productoId);
    if (idx === -1) return false;
    if (cantidad == null) {
      this.items.splice(idx, 1);
      return true;
    }
    this.items[idx].cantidad = round2(this.items[idx].cantidad - Number(cantidad));
    if (this.items[idx].cantidad <= 0) this.items.splice(idx, 1);
    return true;
  }

  eliminar(productoId) {
    return this.quitar(productoId, null);
  }

  vaciar() {
    this.items = [];
    return this;
  }

  get subtotal() {
    return round2(this.items.reduce((acc, i) => acc + i.importe, 0));
  }

  get itbis() {
    return round2(this.subtotal * this.itbisRate);
  }

  get total() {
    return round2(this.subtotal + this.envio + this.itbis);
  }

  toJSON() {
    return {
      telefono: this.telefono,
      items: this.items.map((i) => ({
        productoId: i.productoId,
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precioUnit: i.precioUnit,
        importe: i.importe,
      })),
      subtotal: this.subtotal,
      envio: this.envio,
      itbis: this.itbis,
      total: this.total,
    };
  }
}

module.exports = Carrito;
