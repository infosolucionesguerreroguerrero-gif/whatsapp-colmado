'use strict';

const readline = require('readline');
const IWhatsAppProvider = require('./IWhatsAppProvider');
const logger = require('../logger/logger');

/**
 * Proveedor simulado: usa la terminal como si fuera WhatsApp. Permite probar
 * todo el flujo conversacional sin credenciales. El "from" es un teléfono fijo.
 */
class ConsoleProvider extends IWhatsAppProvider {
  constructor({ telefono = '18090000001', interactive = true } = {}) {
    super();
    this.telefono = telefono;
    this.interactive = interactive;
    this.rl = null;
  }

  async start() {
    logger.info('WhatsApp en modo CONSOLA (simulado). Escribe mensajes como el cliente %s.', this.telefono);
    if (!this.interactive) return;
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    this.rl.setPrompt('cliente> ');
    this.rl.prompt();
    this.rl.on('line', (line) => {
      const text = line.trim();
      if (text) this.emit('message', { from: this.telefono, text, type: 'text' });
      this.rl.prompt();
    });
  }

  async sendText(to, text) {
    // eslint-disable-next-line no-console
    console.log(`\n🟢 [BOT -> ${to}]\n${text}\n`);
    if (this.rl) this.rl.prompt();
    return { ok: true };
  }

  /** Inyecta un mensaje entrante de forma programática (usado en tests/API). */
  inject(from, text) {
    this.emit('message', { from, text, type: 'text' });
  }

  async stop() {
    if (this.rl) this.rl.close();
  }
}

module.exports = ConsoleProvider;
