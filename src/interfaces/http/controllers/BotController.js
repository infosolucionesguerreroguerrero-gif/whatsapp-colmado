'use strict';

const asyncHandler = require('../middlewares/asyncHandler');

/**
 * Controlador HTTP del bot:
 *  - POST /api/bot/message: inyecta un mensaje y devuelve la respuesta del bot
 *    (útil para pruebas y para integrar otros canales).
 *  - GET/POST /api/webhook: endpoint del webhook de WhatsApp Cloud API.
 */
class BotHttpController {
  constructor({ botController, whatsappProvider }) {
    this.bot = botController;
    this.provider = whatsappProvider;

    this.message = asyncHandler(async (req, res) => {
      const { from, text, type } = req.body;
      const respuestas = await this.bot.handle({ from, text, type });
      res.json({ ok: true, data: { respuestas } });
    });

    this.webhookVerify = (req, res) => {
      if (this.provider && typeof this.provider.verify === 'function') {
        const challenge = this.provider.verify(
          req.query['hub.mode'],
          req.query['hub.verify_token'],
          req.query['hub.challenge']
        );
        if (challenge) return res.status(200).send(challenge);
      }
      return res.sendStatus(403);
    };

    this.webhookReceive = asyncHandler(async (req, res) => {
      if (this.provider && typeof this.provider.handleWebhook === 'function') {
        this.provider.handleWebhook(req.body);
      }
      res.sendStatus(200);
    });
  }
}

module.exports = BotHttpController;
