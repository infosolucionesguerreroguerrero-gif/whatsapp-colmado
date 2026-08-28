'use strict';

/* eslint-disable no-unused-vars */

/** Contrato del repositorio de métodos de pago y divisas. */
class IPagoRepository {
  async listarFormasPago() {
    throw new Error('No implementado: listarFormasPago');
  }

  async listarMonedas() {
    throw new Error('No implementado: listarMonedas');
  }
}

module.exports = IPagoRepository;
