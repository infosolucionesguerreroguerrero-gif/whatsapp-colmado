'use strict';

const net = require('net');
const fs = require('fs');
const path = require('path');
const TicketBuilder = require('./TicketBuilder');
const logger = require('../logger/logger');

/**
 * Servicio de impresión. Según el driver configurado:
 *   - network: envía el buffer ESC/POS por TCP (puerto 9100 típico).
 *   - file:    guarda el ticket (.bin ESC/POS y .txt legible) en disco.
 *   - noop:    no imprime (solo registra), útil para pruebas.
 */
class PrinterService {
  constructor({ printerConfig, business }) {
    this.config = printerConfig;
    this.builder = new TicketBuilder({ business, width: printerConfig.width });
  }

  async imprimirPedido(pedido) {
    const buffer = this.builder.toEscPos(pedido);
    const texto = this.builder.toText(pedido);

    switch (this.config.driver) {
      case 'network':
        await this._sendNetwork(buffer);
        break;
      case 'file':
        await this._saveFile(pedido.pedidoId, buffer, texto);
        break;
      case 'noop':
      default:
        logger.info('Impresora en modo noop; ticket no enviado.');
        break;
    }
    return { texto, bytes: buffer.length, driver: this.config.driver };
  }

  _sendNetwork(buffer) {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error('Timeout conectando con la impresora'));
      }, 5000);

      socket.connect(this.config.port, this.config.host, () => {
        socket.write(buffer, () => {
          clearTimeout(timeout);
          socket.end();
          logger.info('Ticket enviado a la impresora %s:%s', this.config.host, this.config.port);
          resolve();
        });
      });
      socket.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async _saveFile(pedidoId, buffer, texto) {
    const dir = path.resolve(this.config.outputDir);
    await fs.promises.mkdir(dir, { recursive: true });
    const base = `ticket-${String(pedidoId).padStart(6, '0')}`;
    await fs.promises.writeFile(path.join(dir, `${base}.bin`), buffer);
    await fs.promises.writeFile(path.join(dir, `${base}.txt`), texto, 'utf8');
    logger.info('Ticket guardado en %s/%s.txt', dir, base);
  }
}

module.exports = PrinterService;
