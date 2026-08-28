'use strict';

const ICuentasPorCobrarRepository = require('../../../../domain/repositories/ICuentasPorCobrarRepository');

/** Implementación en memoria para demostración del módulo Cuentas por Cobrar. */
class MemoryCuentasPorCobrarRepository extends ICuentasPorCobrarRepository {
  constructor(seedData = null) {
    super();
    this._facturas = new Map();
    this._pagos = new Map(); // nroFact -> [{ abono, fecha }]
    this._clientes = new Map();
    this._seed(seedData || _defaultSeed());
  }

  async listarFacturas(filtro = {}) {
    let lista = [...this._facturas.values()];

    if (filtro.codCliente) {
      lista = lista.filter((f) => f.codCliente === filtro.codCliente);
    }
    if (filtro.vendedor) {
      lista = lista.filter((f) => f.vendedor === filtro.vendedor);
    }
    if (filtro.fechaDesde && filtro.fechaHasta) {
      const d1 = new Date(filtro.fechaDesde).getTime();
      const d2 = new Date(filtro.fechaHasta).getTime();
      lista = lista.filter((f) => {
        const t = new Date(f.fechaFact).getTime();
        return t >= d1 && t <= d2;
      });
    }
    if (filtro.diasMin != null && filtro.diasMax != null) {
      lista = lista.filter((f) => f.diasVencido >= filtro.diasMin && f.diasVencido <= filtro.diasMax);
    }

    const ordenMap = {
      codigo: (a, b) => a.codCliente.localeCompare(b.codCliente),
      nombre: (a, b) => a.nombreCliente.localeCompare(b.nombreCliente),
      fecha: (a, b) => new Date(a.fechaFact) - new Date(b.fechaFact),
      factura: (a, b) => String(a.nroFact).localeCompare(String(b.nroFact)),
      tipo: (a, b) => (a.tipoCliente || '').localeCompare(b.tipoCliente || ''),
    };
    const cmp = ordenMap[filtro.orden];
    if (cmp) lista = lista.sort(cmp);
    else lista = lista.sort((a, b) => a.nombreCliente.localeCompare(b.nombreCliente) || new Date(a.fechaFact) - new Date(b.fechaFact));

    return lista.map((f) => this._calcularBal(f));
  }

  async sumarPagos(nroFact) {
    const pagos = this._pagos.get(String(nroFact)) || [];
    return pagos.reduce((acc, p) => acc + Number(p.abono), 0);
  }

  async obtenerCliente(codCliente) {
    return this._clientes.get(codCliente) || null;
  }

  async balancePorCliente(codCliente) {
    const facturas = await this.listarFacturas({ codCliente });
    return facturas.reduce((acc, f) => acc + Number(f.balFact), 0);
  }

  async registrarAbono(nroFact, { monto, fecha = new Date() }) {
    const pagos = this._pagos.get(String(nroFact)) || [];
    pagos.push({ abono: Number(monto), fecha });
    this._pagos.set(String(nroFact), pagos);
    const f = this._facturas.get(String(nroFact));
    if (f) f.abono = pagos.reduce((acc, p) => acc + Number(p.abono), 0);
    return { nroFact, monto, fecha };
  }

  _calcularBal(f) {
    const pagos = this._pagos.get(String(f.nroFact)) || [];
    const totalAbono = pagos.reduce((acc, p) => acc + Number(p.abono), 0);
    f.abono = totalAbono;
    f.balFact = Number(f.neto) - totalAbono - Number(f.devolucion) - Number(f.desctoPago);
    if (f.balFact < 0) f.balFact = 0;
    return { ...f };
  }

  _seed(data) {
    for (const c of data.clientes || []) this._clientes.set(c.codigo, c);
    for (const f of data.facturas || []) {
      const fact = { ...f, diasVencido: this._diasVencido(f.fechaFact) };
      this._facturas.set(String(f.nroFact), fact);
    }
    for (const [nroFact, pagos] of Object.entries(data.pagos || {})) {
      this._pagos.set(String(nroFact), pagos);
    }
  }

  _diasVencido(fechaFact) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fec = new Date(fechaFact);
    fec.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((hoy - fec) / (1000 * 60 * 60 * 24)));
  }
}

function _defaultSeed() {
  const hoy = new Date();
  const dia = (d) => new Date(hoy.getTime() - d * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return {
    clientes: [
      { codigo: 'C001', nombre: 'Juan Pérez', correo: 'juan@example.com' },
      { codigo: 'C002', nombre: 'María García', correo: 'maria@example.com' },
    ],
    facturas: [
      { nroFact: 'F0001', fechaFact: dia(5), codCliente: 'C001', nombreCliente: 'Juan Pérez', montoTotal: 1120, descuento: 0, itebis: 120, neto: 1000, abono: 0, devolucion: 0, desctoPago: 0, balFact: 1000, plazo: 30, ncf: 'B010000000001', vendedor: 'V01', tipoCliente: 'contado' },
      { nroFact: 'F0002', fechaFact: dia(20), codCliente: 'C001', nombreCliente: 'Juan Pérez', montoTotal: 560, descuento: 0, itebis: 60, neto: 500, abono: 0, devolucion: 0, desctoPago: 0, balFact: 500, plazo: 30, ncf: 'B010000000002', vendedor: 'V01', tipoCliente: 'contado' },
      { nroFact: 'F0003', fechaFact: dia(40), codCliente: 'C002', nombreCliente: 'María García', montoTotal: 1120, descuento: 0, itebis: 120, neto: 1000, abono: 200, devolucion: 0, desctoPago: 0, balFact: 800, plazo: 30, ncf: 'B010000000003', vendedor: 'V02', tipoCliente: 'contado' },
      { nroFact: 'F0004', fechaFact: dia(95), codCliente: 'C002', nombreCliente: 'María García', montoTotal: 560, descuento: 0, itebis: 60, neto: 500, abono: 0, devolucion: 0, desctoPago: 0, balFact: 500, plazo: 30, ncf: 'B010000000004', vendedor: 'V02', tipoCliente: 'contado' },
    ],
    pagos: {
      F0003: [{ abono: 200, fecha: new Date().toISOString() }],
    },
  };
}

module.exports = MemoryCuentasPorCobrarRepository;
