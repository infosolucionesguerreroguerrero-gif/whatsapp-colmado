'use strict';

const { round2 } = require('../value-objects/Money');

/** Entidad de dominio: una línea dentro del carrito o del pedido. */
class ItemCarrito {
  constructor({ productoId, descripcion, cantidad, precioUnit }) {
    this.productoId = productoId;
    this.descripcion = descripcion;
    this.cantidad = Number(cantidad);
    this.precioUnit = Number(precioUnit);
  }

  get importe() {
    return round2(this.cantidad * this.precioUnit);
  }
}

module.exports = ItemCarrito;
