'use strict';

const Carrito = require('../src/domain/entities/Carrito');

describe('Carrito (entidad de dominio)', () => {
  test('calcula subtotal, envío y total', () => {
    const c = new Carrito({ telefono: '1', envio: 100, itbisRate: 0 });
    c.agregar({ productoId: 1, descripcion: 'Coca Cola 2L', cantidad: 2, precioUnit: 120 });
    c.agregar({ productoId: 2, descripcion: 'Arroz 10 lb', cantidad: 1, precioUnit: 550 });
    expect(c.subtotal).toBe(790);
    expect(c.total).toBe(890);
  });

  test('agregar el mismo producto acumula cantidad', () => {
    const c = new Carrito({ telefono: '1' });
    c.agregar({ productoId: 1, descripcion: 'Pan', cantidad: 1, precioUnit: 30 });
    c.agregar({ productoId: 1, descripcion: 'Pan', cantidad: 2, precioUnit: 30 });
    expect(c.items).toHaveLength(1);
    expect(c.items[0].cantidad).toBe(3);
  });

  test('quitar reduce cantidad y elimina al llegar a cero', () => {
    const c = new Carrito({ telefono: '1' });
    c.agregar({ productoId: 1, descripcion: 'Pan', cantidad: 3, precioUnit: 30 });
    c.quitar(1, 1);
    expect(c.items[0].cantidad).toBe(2);
    c.quitar(1, 2);
    expect(c.vacio).toBe(true);
  });

  test('itbis se aplica sobre el subtotal', () => {
    const c = new Carrito({ telefono: '1', envio: 0, itbisRate: 0.18 });
    c.agregar({ productoId: 1, descripcion: 'X', cantidad: 1, precioUnit: 100 });
    expect(c.itbis).toBe(18);
    expect(c.total).toBe(118);
  });
});
