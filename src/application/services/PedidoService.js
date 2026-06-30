'use strict';

const Pedido = require('../../domain/entities/Pedido');
const { NotFoundError, ValidationError } = require('../../domain/errors/AppError');

/**
 * Casos de uso de pedidos: confirmar (desde carrito), consultar estado,
 * repetir último, cambiar estado, registrar pago e imprimir.
 *
 * Orquesta repos + impresora + notificador de eventos (WebSocket).
 */
class PedidoService {
  constructor({ pedidoRepository, clienteRepository, carritoService, printerService, business, eventBus = null }) {
    this.pedidos = pedidoRepository;
    this.clientes = clienteRepository;
    this.carritoService = carritoService;
    this.printer = printerService;
    this.business = business;
    this.eventBus = eventBus;
  }

  /** Crea el pedido a partir del carrito del cliente y dispara la impresión. */
  async confirmarDesdeCarrito(telefono, { formaPago = 'efectivo', notas = null } = {}) {
    const cliente = await this.clientes.getByTelefono(telefono);
    if (!cliente) throw new NotFoundError('Cliente no encontrado');

    const carrito = await this.carritoService.obtener(telefono);
    if (carrito.vacio) throw new ValidationError('El carrito está vacío');

    const direccion = cliente.direccionPrincipal;
    const pedido = await this.pedidos.crear({
      clienteId: cliente.clienteId,
      direccionId: direccion ? direccion.direccionId : null,
      items: carrito.items,
      envio: carrito.envio,
      itbisRate: this.business.itbisRate,
      formaPago,
      notas,
      cliente: {
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        direccion: direccion ? direccion.direccion : null,
      },
    });

    if (formaPago) {
      await this.pedidos.registrarPago(pedido.pedidoId, { metodo: formaPago, monto: pedido.total });
    }

    await this.carritoService.limpiar(telefono);
    this._emit('pedido:creado', pedido);

    // Impresión automática (no bloquea la confirmación si la impresora falla)
    let impresion = null;
    try {
      impresion = await this.printer.imprimirPedido(this._conCliente(pedido, cliente, direccion));
    } catch (err) {
      impresion = { error: err.message };
    }

    return { pedido, impresion };
  }

  _conCliente(pedido, cliente, direccion) {
    if (!pedido.cliente) {
      pedido.cliente = {
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        direccion: direccion ? direccion.direccion : null,
      };
    }
    return pedido;
  }

  async obtener(pedidoId) {
    const pedido = await this.pedidos.getById(pedidoId);
    if (!pedido) throw new NotFoundError(`Pedido #${pedidoId} no encontrado`);
    return pedido;
  }

  async estado(pedidoId) {
    const pedido = await this.obtener(pedidoId);
    return {
      pedidoId: pedido.pedidoId,
      estado: pedido.estadoNombre,
      estadoId: pedido.estadoId,
      tiempoEstimadoMin: pedido.tiempoEstimadoMin,
    };
  }

  async cambiarEstado(pedidoId, estadoId) {
    if (!Pedido.ESTADO_NOMBRE[estadoId]) throw new ValidationError('Estado inválido');
    const pedido = await this.pedidos.cambiarEstado(pedidoId, estadoId);
    if (!pedido) throw new NotFoundError(`Pedido #${pedidoId} no encontrado`);
    this._emit('pedido:estado', { pedidoId, estadoId, estado: pedido.estadoNombre });
    return pedido;
  }

  async ultimoDe(telefono) {
    const cliente = await this.clientes.getByTelefono(telefono);
    if (!cliente) return null;
    return this.pedidos.ultimoDeCliente(cliente.clienteId);
  }

  /** Repite el último pedido: recarga sus ítems en un carrito nuevo. */
  async repetirUltimo(telefono) {
    const ultimo = await this.ultimoDe(telefono);
    if (!ultimo) throw new NotFoundError('No tienes pedidos anteriores');
    await this.carritoService.vaciar(telefono);
    const carrito = await this.carritoService.obtener(telefono);
    for (const it of ultimo.items) {
      carrito.agregar({
        productoId: it.productoId,
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        precioUnit: it.precioUnit,
      });
    }
    await this.carritoService.carritos.save(carrito);
    return { ultimo, carrito };
  }

  async registrarPago(pedidoId, pago) {
    return this.pedidos.registrarPago(pedidoId, pago);
  }

  async reimprimir(pedidoId) {
    const pedido = await this.obtener(pedidoId);
    return this.printer.imprimirPedido(pedido);
  }

  listar(filtro = {}) {
    return this.pedidos.list(filtro);
  }

  _emit(evento, data) {
    if (this.eventBus && typeof this.eventBus.emit === 'function') {
      this.eventBus.emit(evento, data);
    }
  }
}

module.exports = PedidoService;
