'use strict';

const IPagoRepository = require('../../../../domain/repositories/IPagoRepository');
const { formasPago, monedas } = require('../../seedData');

/** Implementación en memoria de formas de pago y monedas. */
class MemoryPagoRepository extends IPagoRepository {
  constructor() {
    super();
    this._formasPago = (formasPago || []).map((f) => ({ ...f }));
    this._monedas = (monedas || []).map((m) => ({ ...m }));
  }

  async listarFormasPago() {
    return this._formasPago
      .filter((f) => f.activo !== false)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));
  }

  async listarMonedas() {
    return this._monedas
      .filter((m) => m.activo !== false)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));
  }
}

module.exports = MemoryPagoRepository;
