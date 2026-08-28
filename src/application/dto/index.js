'use strict';

/**
 * DTOs (Data Transfer Objects): forma estable de los datos que cruzan la
 * frontera hacia el exterior (API/bot). Desacoplan las entidades internas
 * de la representación pública.
 */

class ProductoDTO {
  static from(p) {
    return {
      id: p.productoId,
      nombre: p.nombre,
      marca: p.marca,
      presentacion: p.presentacion,
      categoria: p.categoria,
      precio: p.precioEfectivo ?? p.precio,
      precioRegular: p.precio,
      disponible: p.disponible,
      existencia: p.existencia,
      imagenUrl: p.imagenUrl,
    };
  }
}

class CarritoDTO {
  static from(carrito) {
    return carrito.toJSON();
  }
}

class PedidoDTO {
  static from(pedido) {
    return {
      id: pedido.pedidoId,
      clienteId: pedido.clienteId,
      estado: pedido.estadoNombre,
      estadoId: pedido.estadoId,
      items: (pedido.items || []).map((i) => ({
        productoId: i.productoId,
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precioUnit: i.precioUnit,
        importe: i.importe ?? Number(i.cantidad) * Number(i.precioUnit),
      })),
      pagos: (pedido.pagos || []).map((p) => ({
        pagoId: p.pagoId,
        metodo: p.metodo,
        monto: p.monto,
        referencia: p.referencia,
        estado: p.estado,
        moneda: p.moneda,
        montoMoneda: p.montoMoneda,
        tasa: p.tasa,
        prima: p.prima,
      })),
      subtotal: pedido.subtotal,
      envio: pedido.envio,
      itbis: pedido.itbis,
      total: pedido.total,
      formaPago: pedido.formaPago,
      tiempoEstimadoMin: pedido.tiempoEstimadoMin,
      creado: pedido.creado,
    };
  }
}

class ClienteDTO {
  static from(c) {
    return {
      id: c.clienteId,
      telefono: c.telefono,
      nombre: c.nombre,
      direcciones: (c.direcciones || []).map((d) => ({
        id: d.direccionId,
        direccion: d.direccion,
        referencia: d.referencia,
        sector: d.sector,
        esPrincipal: d.esPrincipal,
      })),
    };
  }
}

module.exports = { ProductoDTO, CarritoDTO, PedidoDTO, ClienteDTO };
