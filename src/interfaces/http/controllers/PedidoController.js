'use strict';

const asyncHandler = require('../middlewares/asyncHandler');
const { PedidoDTO } = require('../../../application/dto');

/** Controlador HTTP de pedidos (CRUD + estado + impresión). */
class PedidoController {
  constructor({ pedidoService, clienteService }) {
    this.pedidos = pedidoService;
    this.clientes = clienteService;

    this.listar = asyncHandler(async (req, res) => {
      const filtro = {};
      if (req.query.estadoId) filtro.estadoId = Number(req.query.estadoId);
      if (req.query.clienteId) filtro.clienteId = Number(req.query.clienteId);
      const lista = await this.pedidos.listar(filtro);
      res.json({ ok: true, data: lista.map(PedidoDTO.from) });
    });

    this.obtener = asyncHandler(async (req, res) => {
      const pedido = await this.pedidos.obtener(Number(req.params.id));
      res.json({ ok: true, data: PedidoDTO.from(pedido) });
    });

    // Crea un pedido directo desde API (carga ítems en el carrito y confirma)
    this.crear = asyncHandler(async (req, res) => {
      const { telefono, items, formaPago, notas } = req.body;
      await this.clientes.identificar(telefono);
      const carrito = await this.pedidos.carritoService.obtener(telefono);
      carrito.vaciar();
      for (const it of items) carrito.agregar(it);
      await this.pedidos.carritoService.carritos.save(carrito);
      const { pedido, impresion } = await this.pedidos.confirmarDesdeCarrito(telefono, { formaPago, notas });
      res.status(201).json({ ok: true, data: PedidoDTO.from(pedido), impresion });
    });

    this.actualizarEstado = asyncHandler(async (req, res) => {
      const pedido = await this.pedidos.cambiarEstado(Number(req.params.id), req.body.estadoId);
      res.json({ ok: true, data: PedidoDTO.from(pedido) });
    });

    this.cancelar = asyncHandler(async (req, res) => {
      const pedido = await this.pedidos.cambiarEstado(Number(req.params.id), 6); // Cancelado
      res.json({ ok: true, data: PedidoDTO.from(pedido) });
    });

    this.estado = asyncHandler(async (req, res) => {
      res.json({ ok: true, data: await this.pedidos.estado(Number(req.params.id)) });
    });
  }
}

module.exports = PedidoController;
