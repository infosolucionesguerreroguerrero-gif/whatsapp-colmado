'use strict';

/** Casos de uso del cliente: identificación y registro. */
class ClienteService {
  constructor({ clienteRepository }) {
    this.clientes = clienteRepository;
  }

  /** Reconoce al cliente por su número de WhatsApp (lo crea si no existe). */
  async identificar(telefono) {
    let cliente = await this.clientes.getByTelefono(telefono);
    if (!cliente) {
      cliente = await this.clientes.upsert({ telefono });
    }
    return cliente;
  }

  async actualizarNombre(telefono, nombre) {
    return this.clientes.upsert({ telefono, nombre });
  }

  async agregarDireccion(clienteId, direccion) {
    return this.clientes.addDireccion(clienteId, direccion);
  }

  obtener(telefono) {
    return this.clientes.getByTelefono(telefono);
  }
}

module.exports = ClienteService;
