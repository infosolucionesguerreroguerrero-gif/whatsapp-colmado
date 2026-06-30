'use strict';

const { format } = require('../../domain/value-objects/Money');

/** Plantillas de texto de la conversación (centralizadas y reutilizables). */
const messages = {
  bienvenida(business) {
    return (
      `Bienvenido a ${business.name}.\n\n` +
      'Seleccione una opción:\n\n' +
      '1️⃣ Hacer pedido\n' +
      '2️⃣ Ver ofertas\n' +
      '3️⃣ Consultar pedido\n' +
      '4️⃣ Repetir último pedido\n' +
      '5️⃣ Hablar con un operador'
    );
  },

  pedirNombre() {
    return 'Para registrarte necesito unos datos.\n\n¿Cuál es tu *nombre completo*?';
  },

  pedirDireccion() {
    return 'Gracias. Ahora envíame tu *dirección* (calle y número).';
  },

  pedirReferencia() {
    return '¿Alguna *referencia*? (ej: cerca del parque). Escribe "no" si no aplica.';
  },

  pedirSector() {
    return '¿En qué *sector* vives?';
  },

  registroCompleto(nombre) {
    return `¡Listo, ${nombre}! Ya estás registrado. ✅\n\nEscribe tu pedido, por ejemplo: "quiero dos coca cola 2L y un arroz de 10 lb".`;
  },

  itemsDetectados(agregados, noEncontrados, currency) {
    let txt = 'He encontrado:\n\n';
    for (const a of agregados) {
      txt += `✓ ${a.cantidad} ${a.producto.nombre}  ${format((a.producto.precioEfectivo ?? a.producto.precio) * a.cantidad, currency)}\n`;
    }
    if (noEncontrados.length) {
      txt += `\n⚠️ No encontré: ${noEncontrados.join(', ')}\n`;
    }
    txt += '\n¿Desea agregarlos al carrito?\n1. Sí\n2. No';
    return txt;
  },

  carrito(carrito, currency) {
    if (carrito.vacio) return 'Tu carrito está vacío. 🛒';
    let txt = '🛒 *CARRITO*\n\n';
    for (const i of carrito.items) {
      txt += `${i.cantidad} ${i.descripcion}`.padEnd(26).slice(0, 26) + format(i.importe, currency) + '\n';
    }
    txt += '\n';
    txt += `Subtotal: ${format(carrito.subtotal, currency)}\n`;
    txt += `Envío: ${format(carrito.envio, currency)}\n`;
    if (carrito.itbis > 0) txt += `ITBIS: ${format(carrito.itbis, currency)}\n`;
    txt += `*TOTAL: ${format(carrito.total, currency)}*\n\n`;
    txt += 'Opciones:\n1. Confirmar\n2. Agregar más\n3. Eliminar producto\n4. Cancelar';
    return txt;
  },

  confirmacion(carrito, cliente, currency) {
    const dir = cliente.direccionPrincipal;
    let txt = '🧾 *CONFIRMACIÓN DE PEDIDO*\n\n';
    txt += `Cliente: ${cliente.nombre || 'N/D'}\n`;
    txt += `Teléfono: ${cliente.telefono}\n`;
    txt += `Dirección: ${dir ? dir.direccion : 'N/D'}\n\n`;
    txt += 'Detalle:\n';
    for (const i of carrito.items) {
      txt += `• ${i.cantidad} x ${i.descripcion} = ${format(i.importe, currency)}\n`;
    }
    txt += `\nSubtotal: ${format(carrito.subtotal, currency)}\n`;
    txt += `Envío: ${format(carrito.envio, currency)}\n`;
    if (carrito.itbis > 0) txt += `ITBIS: ${format(carrito.itbis, currency)}\n`;
    txt += `*TOTAL: ${format(carrito.total, currency)}*\n\n`;
    txt += 'Forma de pago:\n1. Efectivo\n2. Transferencia\n3. Tarjeta\n4. Contra entrega\n\n';
    txt += 'Escribe el número de tu forma de pago para confirmar, o "cancelar".';
    return txt;
  },

  pedidoCreado(pedido, currency) {
    return (
      `✅ ¡Pedido confirmado!\n\n` +
      `Pedido #${pedido.pedidoId}\n` +
      `Total: ${format(pedido.total, currency)}\n` +
      `Estado: ${pedido.estadoNombre}\n` +
      `Tiempo estimado: ${pedido.tiempoEstimadoMin || 20} minutos\n\n` +
      'Gracias por tu compra. Escribe "mi pedido" para ver el estado.'
    );
  },

  estadoPedido(estado) {
    return (
      `📦 Pedido #${estado.pedidoId}\n\n` +
      `Estado: ${estado.estado}\n` +
      `Tiempo estimado: ${estado.tiempoEstimadoMin || 20} minutos`
    );
  },

  ofertas(lista, currency) {
    if (!lista.length) return 'No hay ofertas vigentes en este momento.';
    let txt = '🔥 *OFERTAS*\n\n';
    for (const o of lista) {
      txt += `• ${o.nombre}: ${format(o.precioOferta, currency)} (antes ${format(o.precioRegular, currency)})\n`;
    }
    return txt;
  },

  catalogo(productos, currency, titulo = 'CATÁLOGO') {
    if (!productos.length) return 'No encontré productos.';
    let txt = `🧺 *${titulo}*\n\n`;
    for (const p of productos.slice(0, 30)) {
      const disp = p.disponible ? '' : ' (agotado)';
      txt += `• ${p.nombre} — ${format(p.precioEfectivo ?? p.precio, currency)}${disp}\n`;
    }
    return txt;
  },

  categorias(cats) {
    let txt = 'Categorías disponibles:\n\n';
    txt += cats.map((c) => `• ${c.nombre}`).join('\n');
    txt += '\n\nEscribe, por ejemplo: "muéstrame bebidas".';
    return txt;
  },

  repetir(ultimo, currency) {
    let txt = 'He encontrado tu último pedido:\n\n';
    for (const i of ultimo.items) {
      txt += `${i.cantidad} ${i.descripcion} — ${format((i.importe ?? i.cantidad * i.precioUnit), currency)}\n`;
    }
    txt += '\n¿Desea repetir este pedido?\n1. Sí\n2. No';
    return txt;
  },

  operador() {
    return '👤 Un operador te atenderá en breve. Por favor, espera unos minutos.';
  },

  noEntendido() {
    return (
      'No entendí tu mensaje. 🤔\n\n' +
      'Puedes escribir tu pedido (ej: "dos coca cola 2L"), "menú" para ver opciones, ' +
      'o "mi pedido" para consultar el estado.'
    );
  },

  carritoVacio() {
    return 'Tu carrito está vacío. Escribe lo que deseas pedir, por ejemplo: "un arroz de 10 lb".';
  },
};

module.exports = messages;
