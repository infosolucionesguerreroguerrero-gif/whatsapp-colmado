'use strict';

const EventEmitter = require('events');
const env = require('./env');
const logger = require('../infrastructure/logger/logger');

// Repositorios (memory / mssql)
const MemoryProductoRepository = require('../infrastructure/db/repositories/memory/MemoryProductoRepository');
const MemoryClienteRepository = require('../infrastructure/db/repositories/memory/MemoryClienteRepository');
const MemoryPedidoRepository = require('../infrastructure/db/repositories/memory/MemoryPedidoRepository');
const MemoryCarritoRepository = require('../infrastructure/db/repositories/memory/MemoryCarritoRepository');
const SqlProductoRepository = require('../infrastructure/db/repositories/sql/SqlProductoRepository');
const SqlClienteRepository = require('../infrastructure/db/repositories/sql/SqlClienteRepository');
const SqlPedidoRepository = require('../infrastructure/db/repositories/sql/SqlPedidoRepository');

// AI / Printing
const { createNluEngine } = require('../infrastructure/ai/NluEngine');
const PrinterService = require('../infrastructure/printing/PrinterService');

// WhatsApp providers
const ConsoleProvider = require('../infrastructure/whatsapp/ConsoleProvider');
const BaileysProvider = require('../infrastructure/whatsapp/BaileysProvider');
const CloudApiProvider = require('../infrastructure/whatsapp/CloudApiProvider');

// Application services
const CatalogoService = require('../application/services/CatalogoService');
const ClienteService = require('../application/services/ClienteService');
const CarritoService = require('../application/services/CarritoService');
const PedidoService = require('../application/services/PedidoService');

// Bot
const BotController = require('../interfaces/bot/BotController');
const SessionStore = require('../interfaces/bot/SessionStore');

/**
 * Contenedor de Inyección de Dependencias. Construye y cablea todos los
 * componentes según la configuración. Único lugar donde se eligen las
 * implementaciones concretas (Composition Root).
 */
function buildContainer({ whatsappInteractive = true } = {}) {
  const eventBus = new EventEmitter();

  // ---- Repositorios ----
  let productoRepository, clienteRepository, pedidoRepository;
  if (env.db.driver === 'mssql') {
    logger.info('Driver de BD: SQL Server');
    productoRepository = new SqlProductoRepository();
    clienteRepository = new SqlClienteRepository();
    pedidoRepository = new SqlPedidoRepository();
  } else {
    logger.info('Driver de BD: memoria (demo). Configura DB_DRIVER=mssql para producción.');
    productoRepository = new MemoryProductoRepository();
    clienteRepository = new MemoryClienteRepository();
    pedidoRepository = new MemoryPedidoRepository();
  }
  const carritoRepository = new MemoryCarritoRepository();

  // ---- Infra ----
  const nlu = createNluEngine(env.ai);
  const printerService = new PrinterService({ printerConfig: env.printer, business: env.business });

  // ---- Services ----
  const catalogoService = new CatalogoService({ productoRepository });
  const clienteService = new ClienteService({ clienteRepository });
  const carritoService = new CarritoService({ carritoRepository, catalogoService, business: env.business });
  const pedidoService = new PedidoService({
    pedidoRepository,
    clienteRepository,
    carritoService,
    printerService,
    business: env.business,
    eventBus,
  });

  // ---- Bot ----
  const sessionStore = new SessionStore();
  const botController = new BotController({
    nlu,
    clienteService,
    catalogoService,
    carritoService,
    pedidoService,
    business: env.business,
    sessionStore,
  });

  // ---- WhatsApp provider ----
  let whatsappProvider;
  if (env.whatsapp.provider === 'baileys') {
    whatsappProvider = new BaileysProvider({ authDir: env.whatsapp.baileysAuthDir });
  } else if (env.whatsapp.provider === 'cloud') {
    whatsappProvider = new CloudApiProvider({
      token: env.whatsapp.cloud.token,
      phoneNumberId: env.whatsapp.cloud.phoneNumberId,
      apiVersion: env.whatsapp.cloud.apiVersion,
      verifyToken: env.whatsapp.cloud.verifyToken,
    });
  } else {
    whatsappProvider = new ConsoleProvider({ interactive: whatsappInteractive });
  }

  return {
    env,
    eventBus,
    repositories: { productoRepository, clienteRepository, pedidoRepository, carritoRepository },
    services: { catalogoService, clienteService, carritoService, pedidoService },
    nlu,
    printerService,
    botController,
    whatsappProvider,
    sessionStore,
  };
}

module.exports = { buildContainer };
