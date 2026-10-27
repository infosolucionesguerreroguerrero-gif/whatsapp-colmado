'use strict';

const IReciboIngresoRepository = require('../../../../domain/repositories/IReciboIngresoRepository');
const { ValidationError } = require('../../../../domain/errors/AppError');

/** Implementación en memoria para demostración del módulo Recibo de Ingresos. */
class MemoryReciboIngresoRepository extends IReciboIngresoRepository {
  constructor() {
    super();
    this._recibos = new Map();
    this._correlativo = 0;
  }

  async siguienteNumero() {
    return `RI-${String(this._correlativo + 1).padStart(6, '0')}`;
  }

  async guardar(recibo) {
    this._correlativo += 1;
    if (!recibo.numero) recibo.numero = `RI-${String(this._correlativo).padStart(6, '0')}`;
    this._recibos.set(recibo.numero, recibo);
    return recibo;
  }

  async obtener(numero) {
    return this._recibos.get(String(numero)) || null;
  }

  async listar(filtro = {}) {
    let lista = [...this._recibos.values()];
    if (filtro.codCliente) lista = lista.filter((r) => r.codCliente === filtro.codCliente);
    if (filtro.fechaDesde && filtro.fechaHasta) {
      const d1 = new Date(filtro.fechaDesde).getTime();
      const d2 = new Date(filtro.fechaHasta).getTime() + 24 * 60 * 60 * 1000 - 1;
      lista = lista.filter((r) => {
        const t = new Date(r.fecha).getTime();
        return t >= d1 && t <= d2;
      });
    }
    return lista.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }

  async anular(numero) {
    const recibo = this._recibos.get(String(numero));
    if (!recibo) throw new ValidationError(`Recibo no encontrado: ${numero}`);
    recibo.estado = 'anulado';
    return recibo;
  }
}

module.exports = MemoryReciboIngresoRepository;
