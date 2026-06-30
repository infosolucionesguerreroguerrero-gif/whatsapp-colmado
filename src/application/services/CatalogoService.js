'use strict';

/** Casos de uso del catálogo: listar, buscar, categorías y ofertas. */
class CatalogoService {
  constructor({ productoRepository }) {
    this.productos = productoRepository;
  }

  listar(categoria = null) {
    return this.productos.list(categoria);
  }

  buscar(texto) {
    return this.productos.buscar(texto);
  }

  categorias() {
    return this.productos.listCategorias();
  }

  ofertas() {
    return this.productos.listOfertas();
  }

  getProducto(id) {
    return this.productos.getById(id);
  }

  /**
   * Resuelve el mejor producto para un texto libre. Devuelve el primer match.
   */
  async resolver(texto) {
    const resultados = await this.productos.buscar(texto);
    return resultados[0] || null;
  }
}

module.exports = CatalogoService;
