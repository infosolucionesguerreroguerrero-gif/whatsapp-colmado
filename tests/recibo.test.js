'use strict';

const { enteroALetras, numeroALetras } = require('../src/shared/numeroALetras');
const ReciboIngresoService = require('../src/application/services/ReciboIngresoService');
const MemoryReciboIngresoRepository = require('../src/infrastructure/db/repositories/memory/MemoryReciboIngresoRepository');
const MemoryCuentasPorCobrarRepository = require('../src/infrastructure/db/repositories/memory/MemoryCuentasPorCobrarRepository');

function buildService() {
  const reciboRepo = new MemoryReciboIngresoRepository();
  const cxcRepo = new MemoryCuentasPorCobrarRepository();
  const service = new ReciboIngresoService({
    reciboIngresoRepository: reciboRepo,
    cuentasPorCobrarRepository: cxcRepo,
    business: { currency: 'RD$' },
  });
  return { service, reciboRepo, cxcRepo };
}

describe('numeroALetras', () => {
  test('convierte enteros', () => {
    expect(enteroALetras(0)).toBe('CERO');
    expect(enteroALetras(1)).toBe('UNO');
    expect(enteroALetras(15)).toBe('QUINCE');
    expect(enteroALetras(21)).toBe('VEINTIUNO');
    expect(enteroALetras(100)).toBe('CIEN');
    expect(enteroALetras(101)).toBe('CIENTO UNO');
    expect(enteroALetras(1500)).toBe('MIL QUINIENTOS');
    expect(enteroALetras(1000000)).toBe('UN MILLON');
    expect(enteroALetras(2500000)).toBe('DOS MILLONES QUINIENTOS MIL');
  });

  test('convierte montos con centavos en fracción', () => {
    expect(numeroALetras(1500)).toBe('MIL QUINIENTOS PESOS CON 00/100');
    expect(numeroALetras(1500.5)).toBe('MIL QUINIENTOS PESOS CON 50/100');
    expect(numeroALetras(1)).toBe('UN PESOS CON 00/100');
    expect(numeroALetras(0.99)).toBe('CERO PESOS CON 99/100');
  });
});

describe('ReciboIngresoService.crear', () => {
  test('emite recibo con secuencia, letras, abonos y asiento balanceado', async () => {
    const { service, cxcRepo } = buildService();

    const recibo = await service.crear({
      codCliente: 'C001',
      concepto: 'Abono a factura',
      formasPago: [
        { tipo: 'efectivo', monto: 500 },
        { tipo: 'cheque', monto: 500, referencia: '000123', banco: 'Banco Popular' },
      ],
      aplicaciones: [{ nroFact: 'F0001', montoAplicado: 800 }],
      usuario: 'cajero1',
    });

    expect(recibo.numero).toBe('RI-000001');
    expect(recibo.totalRecibido).toBe(1000);
    expect(recibo.totalAplicado).toBe(800);
    expect(recibo.saldoFavor).toBe(200);
    expect(recibo.montoLetras).toBe('MIL PESOS CON 00/100');
    expect(recibo.nombreCliente).toBe('Juan Pérez');

    // Abono registrado en CXC
    expect(await cxcRepo.sumarPagos('F0001')).toBe(800);

    // Asiento: débito caja + cheques, crédito CXC + anticipo
    const { asiento } = recibo;
    expect(asiento.totalDebito).toBe(1000);
    expect(asiento.totalCredito).toBe(1000);
    const cxcLine = asiento.lineas.find((l) => l.cuenta === '1201.01');
    const anticipoLine = asiento.lineas.find((l) => l.cuenta === '2102.01');
    expect(cxcLine.credito).toBe(800);
    expect(anticipoLine.credito).toBe(200);
    expect(asiento.lineas.find((l) => l.cuenta === '1101.01').debito).toBe(500);
    expect(asiento.lineas.find((l) => l.cuenta === '1102.01').debito).toBe(500);

    // Segundo recibo lleva la secuencia
    const r2 = await service.crear({
      codCliente: 'C001',
      formasPago: [{ tipo: 'efectivo', monto: 100 }],
      aplicaciones: [],
    });
    expect(r2.numero).toBe('RI-000002');
  });

  test('rechaza sin formas de pago', async () => {
    const { service } = buildService();
    await expect(service.crear({ codCliente: 'C001', formasPago: [] })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  test('rechaza tipo de pago inválido y cheque sin referencia', async () => {
    const { service } = buildService();
    await expect(
      service.crear({ codCliente: 'C001', formasPago: [{ tipo: 'bitcoin', monto: 100 }] })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      service.crear({ codCliente: 'C001', formasPago: [{ tipo: 'cheque', monto: 100 }] })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test('rechaza aplicado mayor a lo recibido y a factura inexistente', async () => {
    const { service } = buildService();
    await expect(
      service.crear({
        codCliente: 'C001',
        formasPago: [{ tipo: 'efectivo', monto: 100 }],
        aplicaciones: [{ nroFact: 'F0001', montoAplicado: 200 }],
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    await expect(
      service.crear({
        codCliente: 'C001',
        formasPago: [{ tipo: 'efectivo', monto: 1000 }],
        aplicaciones: [{ nroFact: 'F9999', montoAplicado: 100 }],
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test('rechaza aplicado mayor al balance de la factura', async () => {
    const { service } = buildService();
    await expect(
      service.crear({
        codCliente: 'C002',
        formasPago: [{ tipo: 'efectivo', monto: 1000 }],
        aplicaciones: [{ nroFact: 'F0003', montoAplicado: 900 }], // balance es 800
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test('obtener devuelve 404 para recibo inexistente', async () => {
    const { service } = buildService();
    await expect(service.obtener('RI-999999')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('anula un recibo emitido', async () => {
    const { service } = buildService();
    const recibo = await service.crear({
      codCliente: 'C001',
      formasPago: [{ tipo: 'efectivo', monto: 100 }],
    });
    const anulado = await service.anular(recibo.numero);
    expect(anulado.estado).toBe('anulado');
    await expect(service.anular(recibo.numero)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
