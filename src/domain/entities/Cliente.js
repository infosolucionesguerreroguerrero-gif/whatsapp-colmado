'use strict';

/** Entidad de dominio: Cliente del colmado (identificado por su WhatsApp). */
class Cliente {
  constructor({ clienteId = null, telefono, nombre = null, direcciones = [], activo = true } = {}) {
    this.clienteId = clienteId;
    this.telefono = telefono;
    this.nombre = nombre;
    this.direcciones = direcciones;
    this.activo = activo;
  }

  get esNuevo() {
    return !this.clienteId;
  }

  get tieneDatosCompletos() {
    return Boolean(this.nombre) && this.direcciones.length > 0;
  }

  get direccionPrincipal() {
    return this.direcciones.find((d) => d.esPrincipal) || this.direcciones[0] || null;
  }
}

module.exports = Cliente;
