'use strict';

/** Entidad de dominio: Producto del catálogo. */
class Producto {
  constructor({
    productoId = null,
    nombre,
    marca = null,
    presentacion = null,
    unidad = null,
    tamano = null,
    precio = 0,
    precioEfectivo = null,
    categoria = null,
    categoriaId = null,
    existencia = 0,
    disponible = true,
    imagenUrl = null,
    palabras = null,
  } = {}) {
    this.productoId = productoId;
    this.nombre = nombre;
    this.marca = marca;
    this.presentacion = presentacion;
    this.unidad = unidad;
    this.tamano = tamano;
    this.precio = Number(precio);
    this.precioEfectivo = precioEfectivo == null ? Number(precio) : Number(precioEfectivo);
    this.categoria = categoria;
    this.categoriaId = categoriaId;
    this.existencia = Number(existencia);
    this.disponible = Boolean(disponible);
    this.imagenUrl = imagenUrl;
    this.palabras = palabras;
  }

  get etiqueta() {
    return [this.nombre].filter(Boolean).join(' ').trim();
  }
}

module.exports = Producto;
