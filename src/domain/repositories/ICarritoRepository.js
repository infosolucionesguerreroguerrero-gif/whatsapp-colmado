'use strict';

/* eslint-disable no-unused-vars */

/**
 * Contrato del repositorio de carritos temporales (estado de la conversación
 * mientras el cliente arma su pedido). Implementación típica: en memoria/Redis.
 */
class ICarritoRepository {
  async get(telefono) {
    throw new Error('No implementado: get');
  }

  async save(carrito) {
    throw new Error('No implementado: save');
  }

  async clear(telefono) {
    throw new Error('No implementado: clear');
  }
}

module.exports = ICarritoRepository;
