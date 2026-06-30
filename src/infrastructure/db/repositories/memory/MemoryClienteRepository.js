'use strict';

const IClienteRepository = require('../../../../domain/repositories/IClienteRepository');
const Cliente = require('../../../../domain/entities/Cliente');

/** Implementación en memoria del repositorio de clientes (driver "memory"). */
class MemoryClienteRepository extends IClienteRepository {
  constructor() {
    super();
    this._clientes = new Map(); // telefono -> data
    this._seqCliente = 1;
    this._seqDireccion = 1;
  }

  async getByTelefono(telefono) {
    const c = this._clientes.get(telefono);
    return c ? new Cliente(_clone(c)) : null;
  }

  async upsert({ telefono, nombre }) {
    let c = this._clientes.get(telefono);
    if (!c) {
      c = { clienteId: this._seqCliente++, telefono, nombre: nombre || null, direcciones: [], activo: true };
      this._clientes.set(telefono, c);
    } else if (nombre) {
      c.nombre = nombre;
    }
    return new Cliente(_clone(c));
  }

  async addDireccion(clienteId, { direccion, referencia = null, sector = null, esPrincipal = false }) {
    const c = [...this._clientes.values()].find((x) => x.clienteId === Number(clienteId));
    if (!c) return null;
    if (esPrincipal) c.direcciones.forEach((d) => (d.esPrincipal = false));
    const nueva = {
      direccionId: this._seqDireccion++,
      clienteId: c.clienteId,
      direccion,
      referencia,
      sector,
      esPrincipal: Boolean(esPrincipal) || c.direcciones.length === 0,
    };
    c.direcciones.push(nueva);
    return new Cliente(_clone(c));
  }
}

function _clone(o) {
  return JSON.parse(JSON.stringify(o));
}

module.exports = MemoryClienteRepository;
