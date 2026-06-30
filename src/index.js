'use strict';

const env = require('./config/env');
const logger = require('./infrastructure/logger/logger');
const { buildContainer } = require('./config/container');
const { createApp } = require('./interfaces/http/server');
const { startWebSocket } = require('./interfaces/ws/wsServer');

/**
 * Punto de entrada del sistema. Cablea el contenedor, levanta la API REST,
 * el WebSocket y conecta el proveedor de WhatsApp al bot conversacional.
 */
async function main() {
  const container = buildContainer({ whatsappInteractive: env.whatsapp.provider === 'console' });

  // API REST
  const app = createApp(container);
  app.listen(env.port, () => logger.info('API REST en http://localhost:%d/api', env.port));

  // WebSocket
  startWebSocket({ port: env.wsPort, eventBus: container.eventBus });

  // WhatsApp -> Bot
  const { whatsappProvider, botController } = container;
  whatsappProvider.on('message', async (msg) => {
    const respuestas = await botController.handle(msg);
    for (const r of respuestas) {
      await whatsappProvider.sendText(msg.from, r);
    }
  });

  await whatsappProvider.start();
  logger.info('Sistema WhatsApp Colmado iniciado (provider=%s, db=%s, ai=%s).', env.whatsapp.provider, env.db.driver, env.ai.provider);
}

main().catch((err) => {
  logger.error({ err }, 'Fallo al iniciar el sistema');
  process.exit(1);
});
