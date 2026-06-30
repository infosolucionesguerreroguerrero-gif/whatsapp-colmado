'use strict';

const { WebSocketServer } = require('ws');
const logger = require('../../infrastructure/logger/logger');

/**
 * Servidor WebSocket para notificaciones en tiempo real (panel de caja).
 * Reenvía los eventos del eventBus (pedido:creado, pedido:estado) a todos los
 * clientes conectados. Permite seguimiento en vivo del estado de los pedidos.
 */
function startWebSocket({ port, eventBus }) {
  const wss = new WebSocketServer({ port });

  wss.on('connection', (ws) => {
    logger.info('Cliente WebSocket conectado (%d activos)', wss.clients.size);
    ws.send(JSON.stringify({ type: 'hello', message: 'Conectado al canal de pedidos' }));
    ws.on('close', () => logger.info('Cliente WebSocket desconectado'));
  });

  const broadcast = (type, data) => {
    const payload = JSON.stringify({ type, data, ts: new Date().toISOString() });
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(payload);
    }
  };

  eventBus.on('pedido:creado', (p) => broadcast('pedido:creado', { pedidoId: p.pedidoId, total: p.total }));
  eventBus.on('pedido:estado', (e) => broadcast('pedido:estado', e));

  logger.info('WebSocket escuchando en ws://localhost:%d', port);
  return wss;
}

module.exports = { startWebSocket };
