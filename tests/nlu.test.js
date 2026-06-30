'use strict';

const RuleBasedNlu = require('../src/infrastructure/ai/RuleBasedNlu');

const nlu = new RuleBasedNlu();

describe('RuleBasedNlu', () => {
  test('detecta saludo', async () => {
    expect((await nlu.interpret('Hola buenas')).intent).toBe('saludo');
  });

  test('opción de menú numérica', async () => {
    expect((await nlu.interpret('1')).intent).toBe('hacer_pedido');
    expect((await nlu.interpret('2')).intent).toBe('ver_ofertas');
    expect((await nlu.interpret('5')).intent).toBe('operador');
  });

  test('extrae múltiples ítems con cantidades', async () => {
    const r = await nlu.interpret('Quiero dos coca cola de dos litros y un arroz de diez libras');
    expect(r.intent).toBe('hacer_pedido');
    expect(r.items.length).toBe(2);
    expect(r.items[0].cantidad).toBe(2);
    expect(r.items[0].texto).toContain('coca');
    expect(r.items[1].cantidad).toBe(1);
    expect(r.items[1].texto).toContain('arroz');
  });

  test('detecta agregar y quitar', async () => {
    expect((await nlu.interpret('Agrega tres panes')).intent).toBe('agregar');
    expect((await nlu.interpret('Quita una coca')).intent).toBe('quitar');
  });

  test('detecta repetir pedido', async () => {
    expect((await nlu.interpret('lo mismo de ayer')).intent).toBe('repetir_pedido');
  });

  test('detecta consultar pedido', async () => {
    expect((await nlu.interpret('mi pedido')).intent).toBe('consultar_pedido');
  });
});
