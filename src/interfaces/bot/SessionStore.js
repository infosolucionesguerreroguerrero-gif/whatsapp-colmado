'use strict';

/** Estados de la conversación. */
const STATES = Object.freeze({
  MENU: 'MENU',
  REG_NOMBRE: 'REG_NOMBRE',
  REG_DIRECCION: 'REG_DIRECCION',
  REG_REFERENCIA: 'REG_REFERENCIA',
  REG_SECTOR: 'REG_SECTOR',
  CONFIRMAR_ITEMS: 'CONFIRMAR_ITEMS',
  EN_CARRITO: 'EN_CARRITO',
  ELIMINAR_ITEM: 'ELIMINAR_ITEM',
  PAGO: 'PAGO',
  CONFIRMAR_REPETIR: 'CONFIRMAR_REPETIR',
});

/**
 * Almacén de sesiones de conversación en memoria (estado por teléfono).
 * En producción multi-instancia, reemplazar por Redis con TTL.
 */
class SessionStore {
  constructor() {
    this._sessions = new Map();
  }

  get(telefono) {
    if (!this._sessions.has(telefono)) {
      this._sessions.set(telefono, { state: STATES.MENU, data: {} });
    }
    return this._sessions.get(telefono);
  }

  set(telefono, state, data = {}) {
    const s = this.get(telefono);
    s.state = state;
    s.data = { ...s.data, ...data };
    return s;
  }

  reset(telefono) {
    this._sessions.set(telefono, { state: STATES.MENU, data: {} });
  }
}

SessionStore.STATES = STATES;
module.exports = SessionStore;
