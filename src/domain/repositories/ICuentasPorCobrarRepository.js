'use strict';

/* eslint-disable no-unused-vars */

/** Contrato del repositorio de Cuentas por Cobrar Clientes. */
class ICuentasPorCobrarRepository {
  async listarFacturas(filtro = {}) {
    throw new Error('No implementado: listarFacturas');
  }

  async sumarPagos(nroFact) {
    throw new Error('No implementado: sumarPagos');
  }

  async obtenerCliente(codCliente) {
    throw new Error('No implementado: obtenerCliente');
  }

  async balancePorCliente(codCliente) {
    throw new Error('No implementado: balancePorCliente');
  }

  async registrarAbono(nroFact, abono) {
    throw new Error('No implementado: registrarAbono');
  }
}

module.exports = ICuentasPorCobrarRepository;
