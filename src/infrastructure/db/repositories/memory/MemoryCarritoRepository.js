'use strict';

const ICarritoRepository = require('../../../../domain/repositories/ICarritoRepository');
const Carrito = require('../../../../domain/entities/Carrito');

/**
 * Carritos temporales en memoria. Sirve tanto para el driver "memory" como
 * para "mssql" (el carrito es estado de conversación, no se persiste en BD
 * hasta confirmar el pedido). En producción multi-instancia, sustituir por Redis.
 */
class MemoryCarritoRepository extends ICarritoRepository {
  constructor() {
    super();
    this._carritos = new Map(); // telefono -> Carrito
  }

  async get(telefono) {
    return this._carritos.get(telefono) || null;
  }

  async save(carrito) {
    if (!(carrito instanceof Carrito)) carrito = new Carrito(carrito);
    this._carritos.set(carrito.telefono, carrito);
    return carrito;
  }

  async clear(telefono) {
    this._carritos.delete(telefono);
  }
}

module.exports = MemoryCarritoRepository;
