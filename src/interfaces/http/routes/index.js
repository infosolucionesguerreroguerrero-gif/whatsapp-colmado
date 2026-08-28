'use strict';

const express = require('express');

const AuthController = require('../controllers/AuthController');
const CatalogoController = require('../controllers/CatalogoController');
const PedidoController = require('../controllers/PedidoController');
const ClienteController = require('../controllers/ClienteController');
const ImpresionController = require('../controllers/ImpresionController');
const CuentasPorCobrarController = require('../controllers/CuentasPorCobrarController');
const BotHttpController = require('../controllers/BotController');

const { requireAuth } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const schemas = require('../validators/schemas');

/**
 * Define todas las rutas de la API REST. Recibe el contenedor de DI para
 * inyectar los servicios en los controladores.
 */
function buildRoutes(container) {
  const router = express.Router();
  const { services, botController, whatsappProvider } = container;

  const auth = new AuthController();
  const catalogo = new CatalogoController({ catalogoService: services.catalogoService });
  const pedido = new PedidoController({ pedidoService: services.pedidoService, clienteService: services.clienteService });
  const cliente = new ClienteController({ clienteService: services.clienteService });
  const impresion = new ImpresionController({ pedidoService: services.pedidoService });
  const cuentasPorCobrar = new CuentasPorCobrarController({ cuentasPorCobrarService: services.cuentasPorCobrarService });
  const botHttp = new BotHttpController({ botController, whatsappProvider });

  // Salud
  router.get('/health', (_req, res) => res.json({ ok: true, status: 'up', ts: new Date().toISOString() }));

  // Auth
  router.post('/auth/login', validate(schemas.login), auth.login);

  // Catálogo (público para el cliente)
  router.get('/productos', catalogo.productos);
  router.get('/productos/buscar', catalogo.buscar);
  router.get('/categorias', catalogo.categorias);
  router.get('/ofertas', catalogo.ofertas);

  // Clientes
  router.post('/cliente', validate(schemas.crearCliente), cliente.crear);
  router.get('/cliente/:telefono', requireAuth, cliente.obtener);

  // Pedidos
  router.get('/pedido', requireAuth, pedido.listar);
  router.get('/pedido/:id', pedido.obtener);
  router.get('/pedido/:id/estado', pedido.estado);
  router.post('/pedido', validate(schemas.crearPedido), pedido.crear);
  router.put('/pedido/:id', requireAuth, validate(schemas.actualizarEstado), pedido.actualizarEstado);
  router.delete('/pedido/:id', requireAuth, pedido.cancelar);

  // Impresión
  router.post('/imprimir', requireAuth, validate(schemas.imprimir), impresion.imprimir);

  // Cuentas por cobrar
  router.get('/cxc', requireAuth, cuentasPorCobrar.listar);
  router.get('/cxc/actualizar', requireAuth, cuentasPorCobrar.actualizar);
  router.get('/cxc/cliente/:codigo', requireAuth, cuentasPorCobrar.resumenCliente);
  router.get('/cxc/antiguedad/:min/:max', requireAuth, cuentasPorCobrar.porAntiguedad);
  router.get('/cxc/exportar', requireAuth, cuentasPorCobrar.exportarExcel);
  router.get('/cxc/exportar/csv', requireAuth, cuentasPorCobrar.exportarCsv);
  router.post('/cxc/abono', requireAuth, cuentasPorCobrar.registrarAbono);

  // Bot / WhatsApp
  router.post('/bot/message', validate(schemas.mensajeBot), botHttp.message);
  router.get('/webhook', botHttp.webhookVerify);
  router.post('/webhook', botHttp.webhookReceive);

  return router;
}

module.exports = { buildRoutes };
