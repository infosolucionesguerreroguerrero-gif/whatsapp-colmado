'use strict';

const ReciboIngreso = require('../../domain/entities/ReciboIngreso');
const { ValidationError, NotFoundError } = require('../../domain/errors/AppError');
const { numeroALetras } = require('../../shared/numeroALetras');

const EPSILON = 0.005;

/**
 * Casos de uso del Recibo de Ingresos (talonario).
 *
 * Emite un recibo por dinero recibido de un cliente, lo aplica como abonos
 * a sus facturas a crédito (CXC) y genera el asiento contable resultante:
 * débito a la cuenta de cada forma de pago, crédito a Cuentas por Cobrar
 * (y a Anticipos de Clientes por lo no aplicado).
 */
class ReciboIngresoService {
  constructor({ reciboIngresoRepository, cuentasPorCobrarRepository, business }) {
    this.repo = reciboIngresoRepository;
    this.cxc = cuentasPorCobrarRepository;
    this.currency = business?.currency || 'RD$';
    this.business = business || {};
  }

  _ensureRepo() {
    if (!this.repo) throw new Error('ReciboIngresoService requiere un repositorio configurado');
  }

  /**
   * Emite un recibo de ingresos.
   *
   * @param {object} data
   * @param {string} data.codCliente
   * @param {string} [data.nombreCliente]  Si no se pasa, se busca en CXC.
   * @param {string} data.concepto
   * @param {Array}  data.formasPago    [{ tipo, monto, referencia?, banco? }]
   * @param {Array}  [data.aplicaciones] [{ nroFact, montoAplicado }]
   * @param {Date|string} [data.fecha]
   * @param {string} [data.usuario]
   */
  async crear(data = {}) {
    this._ensureRepo();
    const formasPago = this._validarFormasPago(data.formasPago);
    const aplicaciones = this._validarAplicaciones(data.aplicaciones);

    const totalRecibido = formasPago.reduce((a, p) => a + p.monto, 0);
    const totalAplicado = aplicaciones.reduce((a, x) => a + x.montoAplicado, 0);
    if (totalAplicado - totalRecibido > EPSILON) {
      throw new ValidationError('El total aplicado a facturas no puede ser mayor que lo recibido');
    }

    const codCliente = String(data.codCliente || '').trim();
    if (!codCliente) throw new ValidationError('El código de cliente es requerido');

    const nombreCliente = await this._nombreCliente(codCliente, data.nombreCliente);
    await this._validarFacturas(codCliente, aplicaciones);

    const numero = await this.repo.siguienteNumero();
    const fecha = data.fecha ? new Date(data.fecha) : new Date();

    const recibo = new ReciboIngreso({
      numero,
      fecha,
      codCliente,
      nombreCliente,
      concepto: String(data.concepto || '').trim() || `Abono a factura(s) del cliente ${codCliente}`,
      formasPago,
      aplicaciones,
      montoLetras: numeroALetras(totalRecibido),
      usuario: data.usuario || null,
      asiento: this._buildAsiento(numero, formasPago, totalAplicado, totalRecibido, fecha),
    });

    // Registra cada aplicación como abono en CXC.
    for (const ap of aplicaciones) {
      await this.cxc.registrarAbono(ap.nroFact, {
        monto: ap.montoAplicado,
        metodo: 'RECIBO',
        referencia: numero,
        fecha,
      });
    }

    return this.repo.guardar(recibo);
  }

  /** Recibo por número (404 si no existe). */
  async obtener(numero) {
    this._ensureRepo();
    const recibo = await this.repo.obtener(String(numero || '').trim());
    if (!recibo) throw new NotFoundError(`Recibo no encontrado: ${numero}`);
    return recibo;
  }

  /** Lista recibos con filtros { codCliente, fechaDesde, fechaHasta }. */
  async listar(filtro = {}) {
    this._ensureRepo();
    if (filtro.fechaDesde && filtro.fechaHasta && new Date(filtro.fechaDesde) > new Date(filtro.fechaHasta)) {
      throw new ValidationError('La fecha inicial no puede ser mayor que la fecha final');
    }
    return this.repo.listar(filtro);
  }

  /** Anula un recibo emitido. */
  async anular(numero) {
    this._ensureRepo();
    const recibo = await this.obtener(numero);
    if (recibo.estado === ReciboIngreso.ESTADOS.ANULADO) {
      throw new ValidationError(`El recibo ${numero} ya está anulado`);
    }
    return this.repo.anular(recibo.numero);
  }

  /** Formas de pago soportadas con su cuenta contable (para la UI). */
  catalogoFormasPago() {
    return ReciboIngreso.FORMAS_PAGO.map((tipo) => ({
      tipo,
      ...ReciboIngreso.CUENTAS_FORMA_PAGO[tipo],
    }));
  }

  _validarFormasPago(formasPago) {
    if (!Array.isArray(formasPago) || !formasPago.length) {
      throw new ValidationError('Debe indicar al menos una forma de pago');
    }
    return formasPago.map((p, i) => {
      const tipo = String(p.tipo || '').toLowerCase();
      if (!ReciboIngreso.FORMAS_PAGO.includes(tipo)) {
        throw new ValidationError(`Forma de pago inválida en la línea ${i + 1}: ${p.tipo}`);
      }
      const monto = Number(p.monto);
      if (!Number.isFinite(monto) || monto <= 0) {
        throw new ValidationError(`El monto de la forma de pago ${i + 1} debe ser mayor a cero`);
      }
      if (tipo === 'cheque' && !String(p.referencia || '').trim()) {
        throw new ValidationError('El cheque requiere número de referencia');
      }
      return {
        tipo,
        monto: Math.round(monto * 100) / 100,
        referencia: p.referencia != null ? String(p.referencia).trim() : null,
        banco: p.banco != null ? String(p.banco).trim() : null,
      };
    });
  }

  _validarAplicaciones(aplicaciones) {
    if (aplicaciones == null) return [];
    if (!Array.isArray(aplicaciones)) throw new ValidationError('aplicaciones debe ser una lista');
    return aplicaciones.map((a, i) => {
      const nroFact = String(a.nroFact || '').trim();
      if (!nroFact) throw new ValidationError(`La aplicación ${i + 1} requiere número de factura`);
      const montoAplicado = Number(a.montoAplicado);
      if (!Number.isFinite(montoAplicado) || montoAplicado <= 0) {
        throw new ValidationError(`El monto aplicado a la factura ${nroFact} debe ser mayor a cero`);
      }
      return { nroFact, montoAplicado: Math.round(montoAplicado * 100) / 100 };
    });
  }

  async _nombreCliente(codCliente, nombreCliente) {
    if (nombreCliente) return String(nombreCliente).trim();
    if (this.cxc?.obtenerCliente) {
      const cli = await this.cxc.obtenerCliente(codCliente);
      if (cli?.nombre) return cli.nombre;
    }
    return codCliente;
  }

  async _validarFacturas(codCliente, aplicaciones) {
    if (!aplicaciones.length || !this.cxc?.listarFacturas) return;
    const pendientes = await this.cxc.listarFacturas({ codCliente });
    const mapa = new Map(pendientes.map((f) => [String(f.nroFact), f]));
    for (const ap of aplicaciones) {
      const fact = mapa.get(ap.nroFact);
      if (!fact) {
        throw new ValidationError(`La factura ${ap.nroFact} no está pendiente para el cliente ${codCliente}`);
      }
      if (ap.montoAplicado - Number(fact.balFact) > EPSILON) {
        throw new ValidationError(
          `El monto aplicado a ${ap.nroFact} (${ap.montoAplicado}) supera su balance (${fact.balFact})`
        );
      }
    }
  }

  _buildAsiento(numero, formasPago, totalAplicado, totalRecibido, fecha) {
    const porTipo = new Map();
    for (const p of formasPago) porTipo.set(p.tipo, (porTipo.get(p.tipo) || 0) + p.monto);

    const lineas = [];
    for (const [tipo, monto] of porTipo) {
      const cuenta = ReciboIngreso.CUENTAS_FORMA_PAGO[tipo];
      lineas.push({ ...cuenta, debito: this._r2(monto), credito: 0 });
    }

    const cxc = ReciboIngreso.CUENTA_CXC;
    if (totalAplicado > EPSILON) {
      lineas.push({ ...cxc, debito: 0, credito: this._r2(totalAplicado) });
    }
    const excedente = totalRecibido - totalAplicado;
    if (excedente > EPSILON) {
      lineas.push({ ...ReciboIngreso.CUENTA_ANTICIPO, debito: 0, credito: this._r2(excedente) });
    }

    return {
      descripcion: `Recibo de ingresos ${numero}`,
      fecha,
      lineas,
      totalDebito: this._r2(lineas.reduce((a, l) => a + l.debito, 0)),
      totalCredito: this._r2(lineas.reduce((a, l) => a + l.credito, 0)),
    };
  }

  _r2(n) {
    return Math.round(Number(n) * 100) / 100;
  }
}

module.exports = ReciboIngresoService;
