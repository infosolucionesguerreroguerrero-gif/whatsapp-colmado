'use strict';

const Carrito = require('../../domain/entities/Carrito');
const { NotFoundError } = require('../../domain/errors/AppError');

/**
 * Casos de uso del carrito de compras. Resuelve textos de productos contra el
 * catálogo y mantiene el carrito temporal por número de WhatsApp.
 */
class CarritoService {
  constructor({ carritoRepository, catalogoService, business }) {
    this.carritos = carritoRepository;
    this.catalogo = catalogoService;
    this.business = business;
  }

  async obtener(telefono) {
    let carrito = await this.carritos.get(telefono);
    if (!carrito) {
      carrito = new Carrito({
        telefono,
        envio: this.business.deliveryFee,
        itbisRate: this.business.itbisRate,
      });
      await this.carritos.save(carrito);
    }
    return carrito;
  }

  /**
   * Agrega ítems (desde NLU) al carrito. Cada item: { texto, cantidad }.
   * Devuelve { agregados, noEncontrados, carrito }.
   */
  async agregarItems(telefono, items) {
    const carrito = await this.obtener(telefono);
    const agregados = [];
    const noEncontrados = [];

    for (const it of items) {
      const cantidad = Number(it.cantidad) > 0 ? Number(it.cantidad) : 1;
      const producto = await this.catalogo.resolver(it.texto);
      if (!producto) {
        noEncontrados.push(it.texto);
        continue;
      }
      carrito.agregar({
        productoId: producto.productoId,
        descripcion: producto.nombre,
        cantidad,
        precioUnit: producto.precioEfectivo ?? producto.precio,
      });
      agregados.push({ producto, cantidad });
    }

    await this.carritos.save(carrito);
    return { agregados, noEncontrados, carrito };
  }

  /** Quita ítems del carrito por texto. cantidad=null elimina la línea. */
  async quitarItems(telefono, items) {
    const carrito = await this.obtener(telefono);
    const quitados = [];
    for (const it of items) {
      const producto = await this.catalogo.resolver(it.texto);
      if (producto && carrito.quitar(producto.productoId, it.cantidad ?? null)) {
        quitados.push(producto.nombre);
      }
    }
    await this.carritos.save(carrito);
    return { quitados, carrito };
  }

  async vaciar(telefono) {
    const carrito = await this.obtener(telefono);
    carrito.vaciar();
    await this.carritos.save(carrito);
    return carrito;
  }

  async limpiar(telefono) {
    await this.carritos.clear(telefono);
  }

  async ver(telefono) {
    const carrito = await this.carritos.get(telefono);
    if (!carrito) throw new NotFoundError('No hay carrito activo');
    return carrito;
  }
}

module.exports = CarritoService;
