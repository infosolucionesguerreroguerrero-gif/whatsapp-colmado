'use strict';

const path = require('path');
const IWhatsAppProvider = require('./IWhatsAppProvider');
const logger = require('../logger/logger');

/**
 * Proveedor basado en Baileys (WhatsApp Web multi-dispositivo). Requiere la
 * dependencia opcional @whiskeysockets/baileys. La sesión se persiste en disco
 * (authDir) para no escanear el QR cada vez.
 */
class BaileysProvider extends IWhatsAppProvider {
  constructor({ authDir }) {
    super();
    this.authDir = authDir;
    this.sock = null;
  }

  async start() {
    let baileys;
    try {
      baileys = require('@whiskeysockets/baileys');
    } catch (_e) {
      throw new Error(
        'Falta la dependencia "@whiskeysockets/baileys". Instálala con: npm install @whiskeysockets/baileys'
      );
    }
    const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;
    const { state, saveCreds } = await useMultiFileAuthState(path.resolve(this.authDir));
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({ version, auth: state, printQRInTerminal: false });

    this.sock.ev.on('creds.update', saveCreds);
    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        try {
          require('qrcode-terminal').generate(qr, { small: true });
        } catch (_e) {
          logger.info('Escanea este QR (instala qrcode-terminal para verlo): %s', qr);
        }
      }
      if (connection === 'open') logger.info('WhatsApp (Baileys) conectado.');
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const reconnect = code !== DisconnectReason.loggedOut;
        logger.warn('Conexión cerrada (code=%s). Reconectar: %s', code, reconnect);
        if (reconnect) this.start().catch((e) => logger.error({ e }, 'Error al reconectar'));
      }
    });

    this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;
        const from = (msg.key.remoteJid || '').replace(/@s\.whatsapp\.net$/, '');
        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          '';
        const tipo = msg.message.audioMessage ? 'audio' : msg.message.imageMessage ? 'image' : 'text';
        this.emit('message', { from, text, type: tipo, raw: msg });
      }
    });
  }

  async sendText(to, text) {
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    await this.sock.sendMessage(jid, { text });
    return { ok: true };
  }

  async stop() {
    if (this.sock) await this.sock.logout().catch(() => {});
  }
}

module.exports = BaileysProvider;
