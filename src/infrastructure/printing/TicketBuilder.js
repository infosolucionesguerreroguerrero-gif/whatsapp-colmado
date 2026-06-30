'use strict';

const EscPosEncoder = require('./EscPosEncoder');
const { format } = require('../../domain/value-objects/Money');

/**
 * Construye el ticket del pedido en dos formatos:
 *  - texto plano (para vista previa / WhatsApp / archivo .txt)
 *  - buffer ESC/POS (para enviar a la impresora térmica)
 */
class TicketBuilder {
  constructor({ business, width = 42 }) {
    this.business = business;
    this.width = width;
  }

  _sep(ch = '=') {
    return ch.repeat(this.width);
  }

  _row(left, right) {
    const l = String(left);
    const r = String(right);
    const space = Math.max(1, this.width - l.length - r.length);
    return l + ' '.repeat(space) + r;
  }

  _fecha(d) {
    const date = d ? new Date(d) : new Date();
    return {
      fecha: date.toLocaleDateString('es-DO'),
      hora: date.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  /** Devuelve el ticket como texto plano legible. */
  toText(pedido) {
    const c = this.business.currency;
    const { fecha, hora } = this._fecha(pedido.creado);
    const cli = pedido.cliente || {};
    const lines = [];
    lines.push(this._sep('='));
    lines.push(this.business.name);
    lines.push('');
    lines.push(`PEDIDO #${String(pedido.pedidoId).padStart(6, '0')}`);
    lines.push('');
    lines.push(`Fecha: ${fecha}    Hora: ${hora}`);
    lines.push(`Cliente: ${cli.nombre || 'N/D'}`);
    lines.push(`Telefono: ${cli.telefono || 'N/D'}`);
    if (cli.direccion) lines.push(`Direccion: ${cli.direccion}`);
    lines.push(this._sep('-'));
    lines.push(this._row('Cant Producto', 'Importe'));
    lines.push(this._sep('-'));
    for (const it of pedido.items || []) {
      const importe = it.importe ?? Number(it.cantidad) * Number(it.precioUnit);
      lines.push(this._row(`${it.cantidad} ${it.descripcion}`.slice(0, this.width - 10), format(importe, c)));
    }
    lines.push(this._sep('-'));
    lines.push(this._row('Subtotal', format(pedido.subtotal, c)));
    lines.push(this._row('Envio', format(pedido.envio, c)));
    lines.push(this._row('ITBIS', format(pedido.itbis, c)));
    lines.push(this._row('TOTAL', format(pedido.total, c)));
    lines.push('');
    lines.push(`Forma de pago: ${(pedido.formaPago || 'EFECTIVO').toUpperCase()}`);
    lines.push(this._sep('='));
    lines.push('Gracias por su compra');
    lines.push(this._sep('='));
    return lines.join('\n');
  }

  /** Devuelve el buffer ESC/POS listo para imprimir. */
  toEscPos(pedido) {
    const c = this.business.currency;
    const { fecha, hora } = this._fecha(pedido.creado);
    const cli = pedido.cliente || {};
    const enc = new EscPosEncoder();

    enc.align('center').bold(true).doubleHeight(true).line(this.business.name).doubleHeight(false).bold(false);
    enc.line(this.business.phone || '');
    enc.newline();
    enc.bold(true).line(`PEDIDO #${String(pedido.pedidoId).padStart(6, '0')}`).bold(false);
    enc.align('left');
    enc.line(`Fecha: ${fecha}  Hora: ${hora}`);
    enc.line(`Cliente: ${cli.nombre || 'N/D'}`);
    enc.line(`Tel: ${cli.telefono || 'N/D'}`);
    if (cli.direccion) enc.line(`Dir: ${cli.direccion}`);
    enc.line(this._sep('-'));
    for (const it of pedido.items || []) {
      const importe = it.importe ?? Number(it.cantidad) * Number(it.precioUnit);
      enc.line(this._row(`${it.cantidad} ${it.descripcion}`.slice(0, this.width - 10), format(importe, c)));
    }
    enc.line(this._sep('-'));
    enc.line(this._row('Subtotal', format(pedido.subtotal, c)));
    enc.line(this._row('Envio', format(pedido.envio, c)));
    enc.line(this._row('ITBIS', format(pedido.itbis, c)));
    enc.bold(true).line(this._row('TOTAL', format(pedido.total, c))).bold(false);
    enc.newline();
    enc.line(`Forma de pago: ${(pedido.formaPago || 'EFECTIVO').toUpperCase()}`);
    enc.align('center').newline().line('Gracias por su compra').newline(3);
    enc.cut();
    return enc.encode();
  }
}

module.exports = TicketBuilder;
