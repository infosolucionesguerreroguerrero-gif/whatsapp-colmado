'use strict';

const SessionStore = require('./SessionStore');
const messages = require('./messages');
const logger = require('../../infrastructure/logger/logger');

const { STATES } = SessionStore;

/**
 * Orquestador conversacional del bot. Recibe mensajes (desde cualquier
 * proveedor de WhatsApp), interpreta la intención con el NLU y coordina los
 * servicios de la capa de aplicación para responder. Es una máquina de estados.
 */
class BotController {
  constructor({ nlu, clienteService, catalogoService, carritoService, pedidoService, pagoService, business, sessionStore }) {
    this.nlu = nlu;
    this.clientes = clienteService;
    this.catalogo = catalogoService;
    this.carrito = carritoService;
    this.pedidos = pedidoService;
    this.pagos = pagoService;
    this.business = business;
    this.sessions = sessionStore || new SessionStore();
    this.currency = business.currency;
  }

  /** Punto de entrada: procesa un mensaje y devuelve la(s) respuesta(s) [string]. */
  async handle({ from, text, type = 'text' }) {
    try {
      const cliente = await this.clientes.identificar(from);
      const session = this.sessions.get(from);

      if (type === 'audio') {
        return ['🎤 Recibí tu audio. La transcripción de voz requiere configurar IA (AI_ENABLE_VOICE). Por ahora escríbeme tu pedido por texto.'];
      }
      if (type === 'image') {
        return ['📷 Recibí tu imagen. El reconocimiento de productos por foto requiere configurar IA (AI_ENABLE_IMAGE). Por ahora escríbeme tu pedido por texto.'];
      }

      // Estados de registro / flujos que capturan texto crudo
      if (session.state === STATES.REG_NOMBRE) return this._regNombre(from, text);
      if (session.state === STATES.REG_DIRECCION) return this._regDireccion(from, text);
      if (session.state === STATES.REG_REFERENCIA) return this._regReferencia(from, text);
      if (session.state === STATES.REG_SECTOR) return this._regSector(from, text, cliente);

      const nlu = await this.nlu.interpret(text, { state: session.state });
      logger.debug({ from, intent: nlu.intent, items: nlu.items }, 'NLU');

      // Flujos con confirmación pendiente (sí/no u opción numérica)
      if (session.state === STATES.CONFIRMAR_ITEMS) return this._confirmarItems(from, nlu);
      if (session.state === STATES.CONFIRMAR_REPETIR) return this._confirmarRepetir(from, nlu);
      if (session.state === STATES.ELIMINAR_ITEM) return this._eliminarItem(from, nlu, text);
      if (session.state === STATES.PAGO) return this._procesarPago(from, nlu, text);
      if (session.state === STATES.EN_CARRITO) return this._enCarrito(from, nlu, text, cliente);

      // Estado MENU (por defecto): enrutar por intención
      return this._porIntent(from, nlu, cliente, text);
    } catch (err) {
      logger.error({ err: err.message, from }, 'Error en BotController.handle');
      return ['Ocurrió un error procesando tu mensaje. Intenta de nuevo o escribe "menú".'];
    }
  }

  async _porIntent(from, nlu, cliente, text) {
    switch (nlu.intent) {
      case 'saludo':
      case 'menu':
        this.sessions.set(from, STATES.MENU);
        return [messages.bienvenida(this.business)];

      case 'operador':
        return [messages.operador()];

      case 'ver_ofertas': {
        const ofertas = await this.catalogo.ofertas();
        return [messages.ofertas(ofertas, this.currency)];
      }

      case 'catalogo':
        return this._mostrarCatalogo(text);

      case 'consultar_pedido':
        return this._consultarPedido(from, text);

      case 'repetir_pedido':
        return this._iniciarRepetir(from);

      case 'hacer_pedido':
      case 'agregar':
        if (!nlu.items.length) {
          if (!cliente.tieneDatosCompletos) return this._iniciarRegistro(from);
          return ['¿Qué deseas pedir? Escríbelo, por ejemplo: "dos coca cola 2L y un arroz de 10 lb".'];
        }
        return this._detectarYConfirmar(from, nlu, cliente);

      case 'ver_carrito':
        return this._verCarrito(from);

      case 'confirmar':
        return this._irAPago(from, cliente);

      case 'cancelar':
      case 'vaciar':
        await this.carrito.vaciar(from);
        this.sessions.set(from, STATES.MENU);
        return ['Tu carrito fue vaciado. Escribe "menú" para empezar de nuevo.'];

      default:
        // ¿Parece un pedido aunque no se detectara verbo?
        if (nlu.items && nlu.items.length) return this._detectarYConfirmar(from, nlu, cliente);
        return [messages.noEntendido()];
    }
  }

  // ---------- Registro de cliente nuevo ----------
  async _iniciarRegistro(from) {
    this.sessions.set(from, STATES.REG_NOMBRE);
    return [messages.pedirNombre()];
  }

  async _regNombre(from, text) {
    await this.clientes.actualizarNombre(from, text.trim());
    this.sessions.set(from, STATES.REG_DIRECCION);
    return [messages.pedirDireccion()];
  }

  async _regDireccion(from, text) {
    this.sessions.set(from, STATES.REG_REFERENCIA, { _direccion: text.trim() });
    return [messages.pedirReferencia()];
  }

  async _regReferencia(from, text) {
    const ref = /^no$/i.test(text.trim()) ? null : text.trim();
    this.sessions.set(from, STATES.REG_SECTOR, { _referencia: ref });
    return [messages.pedirSector()];
  }

  async _regSector(from, text, cliente) {
    const session = this.sessions.get(from);
    const c = await this.clientes.obtener(from);
    await this.clientes.agregarDireccion(c.clienteId, {
      direccion: session.data._direccion,
      referencia: session.data._referencia,
      sector: text.trim(),
      esPrincipal: true,
    });
    this.sessions.set(from, STATES.MENU, { _direccion: null, _referencia: null });
    return [messages.registroCompleto(c.nombre || cliente.nombre || '')];
  }

  // ---------- Detección y confirmación de ítems ----------
  async _detectarYConfirmar(from, nlu, cliente) {
    if (!cliente.tieneDatosCompletos) {
      // Guardamos los ítems para retomarlos tras el registro
      this.sessions.set(from, STATES.REG_NOMBRE, { _pendientes: nlu.items });
      return [messages.pedirNombre()];
    }
    const { agregados, noEncontrados, carrito } = await this.carrito.agregarItems(from, nlu.items);
    if (!agregados.length) {
      return [`No encontré esos productos: ${noEncontrados.join(', ') || '—'}.\nIntenta con otro nombre o escribe "catálogo".`];
    }
    // Quitamos los recién agregados para mostrarlos como propuesta y pedir confirmación
    this.sessions.set(from, STATES.CONFIRMAR_ITEMS, { _ultimoAgregado: agregados.map((a) => ({ productoId: a.producto.productoId, cantidad: a.cantidad })) });
    // los ítems ya están en el carrito; el "sí" simplemente continúa
    void carrito;
    return [messages.itemsDetectados(agregados, noEncontrados, this.currency)];
  }

  async _confirmarItems(from, nlu) {
    if (nlu.intent === 'si' || nlu.opcion === 1) {
      this.sessions.set(from, STATES.EN_CARRITO);
      const carrito = await this.carrito.obtener(from);
      return [messages.carrito(carrito, this.currency)];
    }
    if (nlu.intent === 'no' || nlu.opcion === 2) {
      // Revertir lo último agregado
      const session = this.sessions.get(from);
      const ultimos = session.data._ultimoAgregado || [];
      const carrito = await this.carrito.obtener(from);
      for (const u of ultimos) carrito.quitar(u.productoId, u.cantidad);
      await this.carrito.carritos.save(carrito);
      this.sessions.set(from, STATES.MENU, { _ultimoAgregado: null });
      return ['Listo, no agregué esos productos. ¿Deseas algo más?'];
    }
    // Si escribió otra cosa, lo tratamos como nuevos ítems
    if (nlu.items && nlu.items.length) {
      const cliente = await this.clientes.identificar(from);
      return this._detectarYConfirmar(from, nlu, cliente);
    }
    return ['Responde "1" para agregar al carrito o "2" para descartar.'];
  }

  // ---------- En carrito ----------
  async _enCarrito(from, nlu, text, cliente) {
    // Intenciones globales (lectura/navegación) siguen disponibles dentro del carrito
    if (['ver_ofertas', 'consultar_pedido', 'menu', 'saludo', 'operador', 'catalogo', 'ver_carrito'].includes(nlu.intent)) {
      return this._porIntent(from, nlu, cliente, text);
    }
    if (nlu.opcion === 1 || nlu.intent === 'confirmar') return this._irAPago(from, cliente);
    if (nlu.opcion === 2 || nlu.intent === 'agregar' || nlu.intent === 'hacer_pedido') {
      if (nlu.items && nlu.items.length) return this._detectarYConfirmar(from, nlu, cliente);
      return ['¿Qué más deseas agregar?'];
    }
    if (nlu.opcion === 3 || nlu.intent === 'quitar') {
      if (nlu.items && nlu.items.length) {
        await this.carrito.quitarItems(from, nlu.items);
        const carrito = await this.carrito.obtener(from);
        return [messages.carrito(carrito, this.currency)];
      }
      this.sessions.set(from, STATES.ELIMINAR_ITEM);
      return ['¿Qué producto deseas eliminar? Escribe su nombre.'];
    }
    if (nlu.opcion === 4 || nlu.intent === 'cancelar' || nlu.intent === 'vaciar') {
      await this.carrito.vaciar(from);
      this.sessions.set(from, STATES.MENU);
      return ['Pedido cancelado. Tu carrito está vacío.'];
    }
    if (nlu.items && nlu.items.length) return this._detectarYConfirmar(from, nlu, cliente);
    const carrito = await this.carrito.obtener(from);
    return [messages.carrito(carrito, this.currency)];
  }

  async _eliminarItem(from, nlu, text) {
    const items = nlu.items && nlu.items.length ? nlu.items : [{ texto: text, cantidad: null }];
    await this.carrito.quitarItems(from, items);
    this.sessions.set(from, STATES.EN_CARRITO);
    const carrito = await this.carrito.obtener(from);
    return [messages.carrito(carrito, this.currency)];
  }

  // ---------- Pago / confirmación final ----------
  async _verCarrito(from) {
    const carrito = await this.carrito.obtener(from);
    if (carrito.vacio) return [messages.carritoVacio()];
    this.sessions.set(from, STATES.EN_CARRITO);
    return [messages.carrito(carrito, this.currency)];
  }

  async _irAPago(from, cliente) {
    const carrito = await this.carrito.obtener(from);
    if (carrito.vacio) {
      this.sessions.set(from, STATES.MENU);
      return [messages.carritoVacio()];
    }
    const full = await this.clientes.obtener(from);
    const formas = await this.pagos.obtenerFormasPago();
    this.sessions.set(from, STATES.PAGO);
    return [messages.confirmacion(carrito, full || cliente, this.currency, formas)];
  }

  async _procesarPago(from, nlu, text) {
    if (nlu.intent === 'cancelar') {
      this.sessions.set(from, STATES.EN_CARRITO);
      return ['Pago cancelado. Tu carrito sigue disponible. Escribe "confirmar" cuando quieras.'];
    }

    const formas = await this.pagos.obtenerFormasPago();
    const normalizado = String(text || '').trim().toLowerCase();

    // Coincidencia por texto libre (nombre o código)
    let seleccionada = formas.find((f) => String(f.nombre).toLowerCase() === normalizado || String(f.codigo).toLowerCase() === normalizado);

    // Coincidencia por opción numérica
    if (!seleccionada && nlu.opcion && nlu.opcion > 0 && nlu.opcion <= formas.length) {
      seleccionada = formas[nlu.opcion - 1];
    }

    if (!seleccionada) {
      const opciones = formas.map((f, i) => `${i + 1}. ${f.nombre}`).join(', ');
      return [`Selecciona la forma de pago: ${opciones}.`];
    }

    const { pedido } = await this.pedidos.confirmarDesdeCarrito(from, { formaPago: seleccionada.nombre.toLowerCase() });
    this.sessions.set(from, STATES.MENU);
    return [messages.pedidoCreado(pedido, this.currency)];
  }

  // ---------- Repetir pedido ----------
  async _iniciarRepetir(from) {
    const ultimo = await this.pedidos.ultimoDe(from);
    if (!ultimo) return ['No tienes pedidos anteriores para repetir.'];
    this.sessions.set(from, STATES.CONFIRMAR_REPETIR);
    return [messages.repetir(ultimo, this.currency)];
  }

  async _confirmarRepetir(from, nlu) {
    if (nlu.intent === 'si' || nlu.opcion === 1) {
      await this.pedidos.repetirUltimo(from);
      this.sessions.set(from, STATES.EN_CARRITO);
      const carrito = await this.carrito.obtener(from);
      return [messages.carrito(carrito, this.currency)];
    }
    this.sessions.set(from, STATES.MENU);
    return ['De acuerdo. Escribe lo que deseas pedir o "menú" para ver opciones.'];
  }

  // ---------- Catálogo / consulta ----------
  async _mostrarCatalogo(text) {
    const cats = await this.catalogo.categorias();
    const t = (text || '').toLowerCase();
    const cat = cats.find((c) => t.includes(c.nombre.toLowerCase()));
    if (cat) {
      const productos = await this.catalogo.listar(cat.nombre);
      return [messages.catalogo(productos, this.currency, cat.nombre.toUpperCase())];
    }
    return [messages.categorias(cats)];
  }

  async _consultarPedido(from, text) {
    const m = String(text).match(/#?(\d{3,})/);
    if (m) {
      try {
        const estado = await this.pedidos.estado(Number(m[1]));
        return [messages.estadoPedido(estado)];
      } catch (_e) {
        return [`No encontré el pedido #${m[1]}.`];
      }
    }
    const ultimo = await this.pedidos.ultimoDe(from);
    if (!ultimo) return ['No tienes pedidos recientes.'];
    const estado = await this.pedidos.estado(ultimo.pedidoId);
    return [messages.estadoPedido(estado)];
  }
}

module.exports = BotController;
