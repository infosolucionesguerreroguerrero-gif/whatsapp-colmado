'use strict';

/* eslint-disable no-unused-vars */

/** Contrato del repositorio de productos / catálogo. */
class IProductoRepository {
  async list(categoria = null) {
    throw new Error('No implementado: list');
  }

  async getById(productoId) {
    throw new Error('No implementado: getById');
  }

  async buscar(texto) {
    throw new Error('No implementado: buscar');
  }

  async listCategorias() {
    throw new Error('No implementado: listCategorias');
  }

  async listOfertas() {
    throw new Error('No implementado: listOfertas');
  }
}

module.exports = IProductoRepository;
