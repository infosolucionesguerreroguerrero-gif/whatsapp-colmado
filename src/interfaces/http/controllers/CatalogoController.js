'use strict';

const asyncHandler = require('../middlewares/asyncHandler');
const { ProductoDTO } = require('../../../application/dto');

/** Controlador HTTP del catálogo (productos, categorías, ofertas). */
class CatalogoController {
  constructor({ catalogoService }) {
    this.catalogo = catalogoService;

    this.productos = asyncHandler(async (req, res) => {
      const items = await this.catalogo.listar(req.query.categoria || null);
      res.json({ ok: true, data: items.map(ProductoDTO.from) });
    });

    this.buscar = asyncHandler(async (req, res) => {
      const items = await this.catalogo.buscar(req.query.q || '');
      res.json({ ok: true, data: items.map(ProductoDTO.from) });
    });

    this.categorias = asyncHandler(async (_req, res) => {
      res.json({ ok: true, data: await this.catalogo.categorias() });
    });

    this.ofertas = asyncHandler(async (_req, res) => {
      res.json({ ok: true, data: await this.catalogo.ofertas() });
    });
  }
}

module.exports = CatalogoController;
