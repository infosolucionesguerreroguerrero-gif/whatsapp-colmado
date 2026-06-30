'use strict';

const EventEmitter = require('events');

/* eslint-disable no-unused-vars */

/**
 * Contrato de un proveedor de WhatsApp. Emite el evento 'message' con
 * { from, text, type, media } y expone sendText/sendImage. Las implementaciones
 * concretas (Baileys, Cloud API, Console) heredan de esta clase.
 */
class IWhatsAppProvider extends EventEmitter {
  async start() {
    throw new Error('No implementado: start');
  }

  async sendText(to, text) {
    throw new Error('No implementado: sendText');
  }

  async stop() {
    /* opcional */
  }
}

module.exports = IWhatsAppProvider;
