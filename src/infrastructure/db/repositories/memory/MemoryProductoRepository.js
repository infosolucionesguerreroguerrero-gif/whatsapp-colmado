'use strict';

const IProductoRepository = require('../../../../domain/repositories/IProductoRepository');
const Producto = require('../../../../domain/entities/Producto');
const { categorias, productos } = require('../../seedData');

/** Implementación en memoria del catálogo (driver "memory"). */
class MemoryProductoRepository extends IProductoRepository {
  constructor() {
    super();
    this._categorias = categorias.map((c) => ({ ...c }));
    this._productos = productos.map((p) => new Producto(p));
  }

  async list(categoria = null) {
    return this._productos.filter((p) => !categoria || _norm(p.categoria) === _norm(categoria));
  }

  async getById(productoId) {
    return this._productos.find((p) => p.productoId === Number(productoId)) || null;
  }

  async buscar(texto) {
    const q = _norm(texto);
    if (!q) return [];
    return this._productos
      .filter((p) => {
        const haystack = _norm([p.nombre, p.marca, p.palabras].filter(Boolean).join(' '));
        return haystack.includes(q);
      })
      .sort((a, b) => {
        const aStarts = _norm(a.nombre).startsWith(q) ? 0 : 1;
        const bStarts = _norm(b.nombre).startsWith(q) ? 0 : 1;
        return aStarts - bStarts;
      });
  }

  async listCategorias() {
    return this._categorias;
  }

  async listOfertas() {
    return this._productos
      .filter((p) => p.precioEfectivo < p.precio)
      .map((p) => ({
        productoId: p.productoId,
        nombre: p.nombre,
        precioRegular: p.precio,
        precioOferta: p.precioEfectivo,
        descripcion: `${p.nombre} en oferta`,
      }));
  }
}

function _norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

module.exports = MemoryProductoRepository;
