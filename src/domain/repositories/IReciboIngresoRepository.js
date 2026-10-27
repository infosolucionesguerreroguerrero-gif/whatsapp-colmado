'use strict';

/* eslint-disable no-unused-vars */

/** Contrato del repositorio de Recibos de Ingresos. */
class IReciboIngresoRepository {
  /** Siguiente número de recibo disponible (p. ej. 'RI-000001'). */
  async siguienteNumero() {
    throw new Error('No implementado: siguienteNumero');
  }

  /** Persiste el recibo completo (cabecera, formas de pago, aplicaciones y asiento). */
  async guardar(recibo) {
    throw new Error('No implementado: guardar');
  }

  /** Recibo por número, o null si no existe. */
  async obtener(numero) {
    throw new Error('No implementado: obtener');
  }

  /** Lista recibos con filtros opcionales { codCliente, fechaDesde, fechaHasta }. */
  async listar(filtro = {}) {
    throw new Error('No implementado: listar');
  }

  /** Marca el recibo como anulado. Devuelve el recibo actualizado. */
  async anular(numero) {
    throw new Error('No implementado: anular');
  }
}

module.exports = IReciboIngresoRepository;
