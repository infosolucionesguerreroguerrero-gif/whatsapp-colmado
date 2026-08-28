'use strict';

const IPagoRepository = require('../../../../domain/repositories/IPagoRepository');
const { getPool } = require('../../sqlServer');

/** Repositorio de formas de pago y monedas sobre SQL Server. */
class SqlPagoRepository extends IPagoRepository {
  async listarFormasPago() {
    const pool = await getPool();
    const result = await pool
      .request()
      .query('SELECT Codigo, Nombre, Orden, RequiereReferencia, EsPagoMultiple, Activo FROM dbo.FormasPago WHERE Activo = 1 ORDER BY Orden, Nombre;');
    return result.recordset.map((r) => ({
      codigo: r.Codigo,
      nombre: r.Nombre,
      orden: r.Orden,
      requiereReferencia: r.RequiereReferencia,
      esPagoMultiple: r.EsPagoMultiple,
      activo: r.Activo,
    }));
  }

  async listarMonedas() {
    const pool = await getPool();
    const result = await pool
      .request()
      .query('SELECT Codigo, Nombre, Simbolo, Tasa, Prima, Activo FROM dbo.Monedas WHERE Activo = 1 ORDER BY Orden, Nombre;');
    return result.recordset.map((r) => ({
      codigo: r.Codigo,
      nombre: r.Nombre,
      simbolo: r.Simbolo,
      tasa: Number(r.Tasa),
      prima: Number(r.Prima),
      activo: r.Activo,
    }));
  }
}

module.exports = SqlPagoRepository;
