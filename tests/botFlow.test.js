'use strict';

/**
 * Prueba de integración del flujo conversacional completo usando el driver de
 * memoria: saludo -> registro -> pedido -> confirmación -> pago -> impresión.
 */
const path = require('path');
const os = require('os');

// Configurar entorno antes de cargar el contenedor
process.env.DB_DRIVER = 'memory';
process.env.AI_PROVIDER = 'rules';
process.env.WHATSAPP_PROVIDER = 'console';
process.env.PRINTER_DRIVER = 'file';
process.env.PRINTER_OUTPUT_DIR = path.join(os.tmpdir(), 'tickets-test');

const { buildContainer } = require('../src/config/container');

describe('Flujo de pedido por WhatsApp (integración)', () => {
  let bot;
  const from = '18095550123';

  beforeAll(() => {
    const container = buildContainer({ whatsappInteractive: false });
    bot = container.botController;
  });

  async function say(text, type = 'text') {
    const r = await bot.handle({ from, text, type });
    return r.join('\n');
  }

  test('saludo muestra el menú', async () => {
    const r = await say('hola');
    expect(r).toContain('Hacer pedido');
  });

  test('cliente nuevo es registrado antes de pedir', async () => {
    const r = await say('quiero dos coca cola 2L');
    expect(r.toLowerCase()).toContain('nombre');
    await say('Juan Perez'); // nombre
    await say('Calle Duarte 25'); // direccion
    await say('no'); // referencia
    const fin = await say('Los Mina'); // sector
    expect(fin.toLowerCase()).toContain('registrado');
  });

  test('hace un pedido, confirma y paga (genera pedido)', async () => {
    const det = await say('quiero dos coca cola 2L y un arroz de 10 lb');
    expect(det).toContain('He encontrado');
    const carrito = await say('1'); // sí, agregar
    expect(carrito).toContain('CARRITO');
    expect(carrito).toContain('TOTAL');
    const conf = await say('1'); // confirmar
    expect(conf).toContain('CONFIRMACIÓN');
    const creado = await say('1'); // efectivo
    expect(creado).toContain('Pedido #');
    expect(creado).toContain('confirmado');
  });

  test('consultar último pedido devuelve estado', async () => {
    const r = await say('mi pedido');
    expect(r).toContain('Estado');
  });

  test('repetir pedido recarga el carrito', async () => {
    const r = await say('repetir pedido');
    expect(r.toLowerCase()).toContain('repetir');
    const carrito = await say('1');
    expect(carrito).toContain('CARRITO');
  });

  test('ver ofertas lista promociones', async () => {
    const r = await say('ofertas');
    expect(r.toUpperCase()).toContain('OFERTA');
  });
});
