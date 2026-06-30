'use strict';

const TicketBuilder = require('../src/infrastructure/printing/TicketBuilder');
const EscPosEncoder = require('../src/infrastructure/printing/EscPosEncoder');

const business = { name: 'COLMADO TEST', phone: '809-555-0000', currency: 'RD$', itbisRate: 0 };

const pedido = {
  pedidoId: 1054,
  subtotal: 790,
  envio: 100,
  itbis: 0,
  total: 890,
  formaPago: 'efectivo',
  tiempoEstimadoMin: 20,
  creado: '2024-01-01T12:00:00Z',
  cliente: { nombre: 'Juan Perez', telefono: '18091234567', direccion: 'Calle 1' },
  items: [
    { descripcion: 'Coca Cola 2L', cantidad: 2, precioUnit: 120, importe: 240 },
    { descripcion: 'Arroz 10 lb', cantidad: 1, precioUnit: 550, importe: 550 },
  ],
};

describe('TicketBuilder', () => {
  const builder = new TicketBuilder({ business, width: 42 });

  test('genera ticket de texto con totales', () => {
    const txt = builder.toText(pedido);
    expect(txt).toContain('COLMADO TEST');
    expect(txt).toContain('PEDIDO #001054');
    expect(txt).toContain('Coca Cola 2L');
    expect(txt).toContain('TOTAL');
    expect(txt).toContain('890');
  });

  test('genera buffer ESC/POS no vacío', () => {
    const buf = builder.toEscPos(pedido);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(50);
    // inicia con ESC @ (reset)
    expect(buf[0]).toBe(0x1b);
    expect(buf[1]).toBe(0x40);
  });
});

describe('EscPosEncoder', () => {
  test('encadena comandos y produce buffer', () => {
    const buf = new EscPosEncoder().align('center').bold(true).text('Hola').cut().encode();
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.includes(Buffer.from('Hola', 'latin1'))).toBe(true);
  });
});
