'use strict';

/* eslint-disable no-unused-vars */

/**
 * Contrato (interfaz) del repositorio de clientes. La capa de aplicación
 * depende de esta abstracción, no de una implementación concreta (DIP).
 */
class IClienteRepository {
  async getByTelefono(telefono) {
    throw new Error('No implementado: getByTelefono');
  }

  async upsert({ telefono, nombre }) {
    throw new Error('No implementado: upsert');
  }

  async addDireccion(clienteId, direccion) {
    throw new Error('No implementado: addDireccion');
  }
}

module.exports = IClienteRepository;
