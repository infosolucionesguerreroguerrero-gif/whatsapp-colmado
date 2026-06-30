'use strict';

/**
 * Demo interactiva del bot en la terminal (sin WhatsApp ni HTTP).
 * Ejecuta: npm run bot:console
 */
const { buildContainer } = require('../src/config/container');

async function main() {
  process.env.WHATSAPP_PROVIDER = 'console';
  const container = buildContainer({ whatsappInteractive: true });
  const { whatsappProvider, botController } = container;

  whatsappProvider.on('message', async (msg) => {
    const respuestas = await botController.handle(msg);
    for (const r of respuestas) await whatsappProvider.sendText(msg.from, r);
  });

  await whatsappProvider.start();
  // Mensaje inicial de bienvenida
  whatsappProvider.inject(whatsappProvider.telefono, 'hola');
}

main();
