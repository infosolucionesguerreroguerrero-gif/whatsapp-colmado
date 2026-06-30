'use strict';

const IWhatsAppProvider = require('./IWhatsAppProvider');
const logger = require('../logger/logger');

/**
 * Proveedor basado en WhatsApp Cloud API (Meta). Los mensajes entrantes llegan
 * por webhook HTTP (ver interfaces/http/routes/webhook.routes.js), que invoca
 * handleWebhook(). Los salientes se envían por la Graph API (fetch nativo).
 */
class CloudApiProvider extends IWhatsAppProvider {
  constructor({ token, phoneNumberId, apiVersion, verifyToken }) {
    super();
    this.token = token;
    this.phoneNumberId = phoneNumberId;
    this.apiVersion = apiVersion;
    this.verifyToken = verifyToken;
  }

  async start() {
    if (!this.token || !this.phoneNumberId) {
      logger.warn('WhatsApp Cloud API sin credenciales: solo recibirá por webhook si se configuran.');
    } else {
      logger.info('WhatsApp Cloud API listo (phoneNumberId=%s).', this.phoneNumberId);
    }
  }

  /** Verificación del webhook (GET) requerida por Meta. */
  verify(mode, token, challenge) {
    if (mode === 'subscribe' && token === this.verifyToken) return challenge;
    return null;
  }

  /** Procesa el payload del webhook (POST) y emite 'message'. */
  handleWebhook(body) {
    try {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const msg = value?.messages?.[0];
      if (!msg) return;
      const from = msg.from;
      const tipo = msg.type;
      const text =
        msg.text?.body || msg.button?.text || msg.interactive?.list_reply?.title || msg.image?.caption || '';
      this.emit('message', { from, text, type: tipo, raw: msg });
    } catch (err) {
      logger.error({ err }, 'Error procesando webhook de WhatsApp Cloud');
    }
  }

  async sendText(to, text) {
    if (!this.token || !this.phoneNumberId) {
      logger.warn('No se envió mensaje: faltan credenciales de Cloud API.');
      return { ok: false };
    }
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
    });
    if (!res.ok) {
      const detail = await res.text();
      logger.error('Error enviando a Cloud API: %s', detail);
      return { ok: false };
    }
    return { ok: true };
  }
}

module.exports = CloudApiProvider;
