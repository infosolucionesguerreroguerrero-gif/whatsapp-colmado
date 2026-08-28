'use strict';

const Pedido = require('../../domain/entities/Pedido');
const { NotFoundError, ValidationError } = require('../../domain/errors/AppError');
const { round2 } = require('../../domain/value-objects/Money');

/**
 * Casos de uso del diálogo de pago: formas dinámicas, múltiples pagos,
 * divisas con tasa/prima, cálculo de cambio y disparo de facturación electrónica.
 */
class PagoService {
  constructor({
    pedidoRepository,
    pagoRepository,
    facturacionElectronicaService = null,
    ecfApiUrl = null,
    business = {},
    logger = console,
  }) {
    this.pedidos = pedidoRepository;
    this.pagos = pagoRepository;
    this.fe = facturacionElectronicaService;
    this.ecfApiUrl = ecfApiUrl;
    this.business = business;
    this.logger = logger;
  }

  async obtenerFormasPago() {
    return this.pagos.listarFormasPago();
  }

  async obtenerMonedas() {
    return this.pagos.listarMonedas();
  }

  async calcular(pedidoId, lineas = []) {
    const pedido = await this.pedidos.getById(pedidoId);
    if (!pedido) throw new NotFoundError('Pedido no encontrado');
    const [formas, monedas] = await Promise.all([this.obtenerFormasPago(), this.obtenerMonedas()]);
    return this._calcularResumen(pedido, lineas, formas, monedas);
  }

  async procesar(pedidoId, { lineas = [], rncComprador = null, generarFe = false }) {
    const pedido = await this.pedidos.getById(pedidoId);
    if (!pedido) throw new NotFoundError('Pedido no encontrado');

    const [formas, monedas] = await Promise.all([this.obtenerFormasPago(), this.obtenerMonedas()]);
    const resumen = this._calcularResumen(pedido, lineas, formas, monedas);

    if (!resumen.completado) {
      throw new ValidationError(`Faltan ${this._fmt(resumen.faltante)} para completar el pago`);
    }

    const pagosRegistrados = [];
    for (const l of resumen.lineas) {
      const p = await this.pedidos.registrarPago(pedidoId, {
        metodo: l.metodo,
        monto: l.montoBase,
        referencia: l.referencia || null,
        estado: 'pagado',
        moneda: l.moneda || null,
        montoMoneda: l.montoMoneda,
        tasa: l.tasa,
        prima: l.prima,
      });
      pagosRegistrados.push(p);
    }

    const principal = this._formaPrincipal(resumen.lineas, formas);
    await this.pedidos.actualizarFormaPago(pedidoId, principal);
    await this.pedidos.cambiarEstado(pedidoId, Pedido.ESTADOS.CONFIRMADO);

    let facturacionElectronica = null;
    if (generarFe) {
      try {
        facturacionElectronica = await this.generarFacturaElectronica(pedido, rncComprador, resumen);
      } catch (err) {
        this.logger.error({ err }, 'Error al generar factura electrónica');
        facturacionElectronica = { completado: false, razon: err.message };
      }
    }

    const pedidoActualizado = await this.pedidos.getById(pedidoId);
    return { pedido: pedidoActualizado, pagos: pagosRegistrados, cambio: resumen.cambio, facturacionElectronica };
  }

  async generarFacturaElectronica(pedido, rncComprador, resumen) {
    const preFactura = this._construirPreFactura(pedido, rncComprador, resumen);

    if (this.ecfApiUrl) {
      const resp = await fetch(`${this.ecfApiUrl}/documentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preFactura),
      });
      if (!resp.ok) throw new Error(`Portal ECF respondió ${resp.status}`);
      return resp.json();
    }

    if (this.fe) {
      return this.fe.facturacionElectronicaProduccion(preFactura);
    }

    return { completado: false, razon: 'Facturación electrónica no configurada', preFactura };
  }

  _calcularResumen(pedido, lineas, formas, monedas) {
    if (!Array.isArray(lineas) || lineas.length === 0) {
      throw new ValidationError('Debe indicar al menos una línea de pago');
    }

    const pagadoPrevio = (pedido.pagos || [])
      .filter((p) => p.estado === 'pagado')
      .reduce((acc, p) => acc + Number(p.monto), 0);

    const totalPendiente = round2(pedido.total - pagadoPrevio);
    let totalPagado = 0;
    const detalle = [];

    for (const l of lineas) {
      const metodo = String(l.metodo || '').trim().toLowerCase();
      const forma = this._buscarForma(metodo, formas);
      if (!forma) throw new ValidationError(`Forma de pago inválida: ${l.metodo}`);

      const monedaCodigo = l.moneda ? String(l.moneda).trim().toUpperCase() : null;
      const moneda = monedaCodigo ? this._buscarMoneda(monedaCodigo, monedas) : null;

      let montoBase = Number(l.monto);
      let montoMoneda = null;
      let tasa = null;
      let prima = null;

      if (moneda) {
        if (!moneda.tasa || Number(moneda.tasa) <= 0) {
          throw new ValidationError(`Moneda ${moneda.codigo} sin tasa definida`);
        }
        montoMoneda = Number(l.montoMoneda != null ? l.montoMoneda : l.monto);
        tasa = Number(moneda.tasa);
        prima = Number(moneda.prima || 0);
        montoBase = round2(montoMoneda * tasa * (1 + prima / 100));
      } else if (!Number.isFinite(montoBase) || montoBase <= 0) {
        throw new ValidationError('El monto debe ser mayor a cero');
      }

      if (forma.requiereReferencia && !l.referencia) {
        throw new ValidationError(`La forma de pago ${forma.nombre} requiere referencia`);
      }

      totalPagado += montoBase;
      detalle.push({
        metodo: forma.nombre.toLowerCase(),
        metodoCodigo: forma.codigo,
        montoBase: round2(montoBase),
        moneda: moneda ? moneda.codigo : null,
        montoMoneda,
        tasa,
        prima,
        referencia: l.referencia || null,
        requiereReferencia: forma.requiereReferencia,
      });
    }

    const cambio = round2(totalPagado - totalPendiente);
    const faltante = round2(totalPendiente - totalPagado);

    return {
      total: pedido.total,
      pagadoPrevio,
      totalPendiente,
      totalPagado: round2(totalPagado),
      cambio: cambio > 0 ? cambio : 0,
      faltante: faltante > 0 ? faltante : 0,
      completado: faltante <= 0,
      lineas: detalle,
    };
  }

  _buscarForma(metodo, formas) {
    const codigo = String(metodo).toLowerCase();
    return formas.find((f) => String(f.codigo).toLowerCase() === codigo || String(f.nombre).toLowerCase() === codigo);
  }

  _buscarMoneda(codigo, monedas) {
    const c = String(codigo).toUpperCase();
    return monedas.find((m) => String(m.codigo).toUpperCase() === c);
  }

  _formaPrincipal(lineas, formas) {
    if (lineas.length === 1) return lineas[0].metodoCodigo || lineas[0].metodo;
    const multiple = formas.find((f) => f.esPagoMultiple);
    return multiple ? multiple.codigo : 'multiple';
  }

  _construirPreFactura(pedido, rncComprador, resumen) {
    const fecha = new Date();
    const items = (pedido.items || []).map((i, idx) => ({
      linea: idx + 1,
      productoId: i.productoId,
      descripcion: i.descripcion,
      cantidad: Number(i.cantidad),
      precioUnit: Number(i.precioUnit),
      importe: round2(Number(i.cantidad) * Number(i.precioUnit)),
    }));

    return {
      numeroFactura: pedido.pedidoId,
      encfNumero: '', // Se asigna en el portal de facturación
      ncf: '',
      tipoCom: 31,
      rncComprador: rncComprador || '',
      rncEmisor: this.business.rnc || '',
      nombreEmisor: this.business.name || '',
      telefonoEmisor: this.business.phone || '',
      direccionEmisor: this.business.address || '',
      fechaEmision: fecha.toISOString(),
      montoTotal: round2(resumen.totalPagado || pedido.total),
      montoTotalStr: (resumen.totalPagado || pedido.total).toFixed(2),
      neto: round2(pedido.total - pedido.itbis),
      itbis: round2(pedido.itbis),
      subtotal: round2(pedido.subtotal),
      envio: round2(pedido.envio),
      total: round2(pedido.total),
      pagos: resumen.lineas.map((l) => ({
        metodo: l.metodo,
        monto: l.montoBase,
        moneda: l.moneda,
      })),
      items,
      nombreComprobante: `E31_${pedido.pedidoId}`,
    };
  }

  _fmt(amount) {
    const value = Number(amount || 0).toLocaleString('es-DO', { minimumFractionDigits: 2 });
    return `${this.business.currency || 'RD$'}${value}`;
  }
}

module.exports = PagoService;
