'use strict';

/* eslint-disable no-unused-vars */

/** Contrato del repositorio de pedidos. */
class IPedidoRepository {
  async crear(pedidoData) {
    throw new Error('No implementado: crear');
  }

  async getById(pedidoId) {
    throw new Error('No implementado: getById');
  }

  async cambiarEstado(pedidoId, estadoId) {
    throw new Error('No implementado: cambiarEstado');
  }

  async ultimoDeCliente(clienteId) {
    throw new Error('No implementado: ultimoDeCliente');
  }

  async registrarPago(pedidoId, pago) {
    throw new Error('No implementado: registrarPago');
  }

  async actualizarFormaPago(pedidoId, formaPago) {
    throw new Error('No implementado: actualizarFormaPago');
  }

  async actualizarCargoTC(pedidoId, cargoTC) {
    throw new Error('No implementado: actualizarCargoTC');
  }

  async list(filtro = {}) {
    throw new Error('No implementado: list');
  }
}

module.exports = IPedidoRepository;
