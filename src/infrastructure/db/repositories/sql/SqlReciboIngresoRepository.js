'use strict';

const IReciboIngresoRepository = require('../../../../domain/repositories/IReciboIngresoRepository');
const ReciboIngreso = require('../../../../domain/entities/ReciboIngreso');
const { sql, getPool } = require('../../sqlServer');

/**
 * Repositorio SQL Server de Recibos de Ingresos.
 * Persiste cabecera, formas de pago, aplicaciones y asiento contable en las
 * tablas creadas por sql/07_recibos_ingresos.sql.
 */
class SqlReciboIngresoRepository extends IReciboIngresoRepository {
  async siguienteNumero() {
    const pool = await getPool();
    const result = await pool.request().query(
      `SELECT ISNULL(MAX(ReciboId), 0) + 1 AS siguiente FROM dbo.RecibosIngresos`
    );
    return `RI-${String(result.recordset[0].siguiente).padStart(6, '0')}`;
  }

  async guardar(recibo) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();

      const reqHeader = new sql.Request(transaction);
      const header = await reqHeader
        .input('Numero', sql.VarChar(20), recibo.numero)
        .input('Fecha', sql.DateTime, new Date(recibo.fecha))
        .input('CodCliente', sql.VarChar(30), recibo.codCliente)
        .input('NombreCliente', sql.NVarChar(150), recibo.nombreCliente)
        .input('Concepto', sql.NVarChar(300), recibo.concepto)
        .input('MontoTotal', sql.Decimal(14, 2), recibo.totalRecibido)
        .input('MontoAplicado', sql.Decimal(14, 2), recibo.totalAplicado)
        .input('SaldoFavor', sql.Decimal(14, 2), recibo.saldoFavor)
        .input('MontoLetras', sql.NVarChar(300), recibo.montoLetras)
        .input('Estado', sql.VarChar(20), recibo.estado)
        .input('Usuario', sql.NVarChar(60), recibo.usuario)
        .query(
          `INSERT INTO dbo.RecibosIngresos
             (Numero, Fecha, CodCliente, NombreCliente, Concepto, MontoTotal, MontoAplicado, SaldoFavor, MontoLetras, Estado, Usuario)
           OUTPUT INSERTED.ReciboId
           VALUES (@Numero, @Fecha, @CodCliente, @NombreCliente, @Concepto, @MontoTotal, @MontoAplicado, @SaldoFavor, @MontoLetras, @Estado, @Usuario)`
        );
      const reciboId = header.recordset[0].ReciboId;

      for (const p of recibo.formasPago) {
        await new sql.Request(transaction)
          .input('ReciboId', sql.Int, reciboId)
          .input('Tipo', sql.VarChar(20), p.tipo)
          .input('Monto', sql.Decimal(14, 2), p.monto)
          .input('Referencia', sql.NVarChar(60), p.referencia)
          .input('Banco', sql.NVarChar(60), p.banco)
          .query(
            `INSERT INTO dbo.ReciboFormasPago (ReciboId, Tipo, Monto, Referencia, Banco)
             VALUES (@ReciboId, @Tipo, @Monto, @Referencia, @Banco)`
          );
      }

      for (const a of recibo.aplicaciones) {
        await new sql.Request(transaction)
          .input('ReciboId', sql.Int, reciboId)
          .input('NroFact', sql.VarChar(30), a.nroFact)
          .input('MontoAplicado', sql.Decimal(14, 2), a.montoAplicado)
          .query(
            `INSERT INTO dbo.ReciboAplicaciones (ReciboId, NroFact, MontoAplicado)
             VALUES (@ReciboId, @NroFact, @MontoAplicado)`
          );
      }

      if (recibo.asiento) {
        const reqAsiento = new sql.Request(transaction);
        const asiento = await reqAsiento
          .input('ReciboId', sql.Int, reciboId)
          .input('Fecha', sql.DateTime, new Date(recibo.asiento.fecha || recibo.fecha))
          .input('Descripcion', sql.NVarChar(200), recibo.asiento.descripcion)
          .query(
            `INSERT INTO dbo.AsientosContables (ReciboId, Fecha, Descripcion)
             OUTPUT INSERTED.AsientoId
             VALUES (@ReciboId, @Fecha, @Descripcion)`
          );
        const asientoId = asiento.recordset[0].AsientoId;

        for (const l of recibo.asiento.lineas) {
          await new sql.Request(transaction)
            .input('AsientoId', sql.Int, asientoId)
            .input('Cuenta', sql.VarChar(30), l.cuenta)
            .input('Descripcion', sql.NVarChar(120), l.descripcion)
            .input('Debito', sql.Decimal(14, 2), l.debito)
            .input('Credito', sql.Decimal(14, 2), l.credito)
            .query(
              `INSERT INTO dbo.AsientoDetalle (AsientoId, Cuenta, Descripcion, Debito, Credito)
               VALUES (@AsientoId, @Cuenta, @Descripcion, @Debito, @Credito)`
            );
        }
      }

      await transaction.commit();
      return recibo;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  async obtener(numero) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Numero', sql.VarChar(20), String(numero))
      .query('SELECT * FROM dbo.RecibosIngresos WHERE Numero = @Numero');
    const row = result.recordset[0];
    if (!row) return null;
    return this._cargarDetalle(pool, row);
  }

  async listar(filtro = {}) {
    const pool = await getPool();
    const request = pool.request();
    let query = 'SELECT * FROM dbo.RecibosIngresos WHERE 1=1';
    if (filtro.codCliente) {
      query += ' AND CodCliente = @CodCliente';
      request.input('CodCliente', sql.VarChar(30), filtro.codCliente);
    }
    if (filtro.fechaDesde && filtro.fechaHasta) {
      query += ' AND CAST(Fecha AS DATE) BETWEEN @FechaDesde AND @FechaHasta';
      request.input('FechaDesde', sql.Date, new Date(filtro.fechaDesde));
      request.input('FechaHasta', sql.Date, new Date(filtro.fechaHasta));
    }
    query += ' ORDER BY Fecha DESC, ReciboId DESC';
    const result = await request.query(query);
    return Promise.all(result.recordset.map((row) => this._cargarDetalle(pool, row)));
  }

  async anular(numero) {
    const pool = await getPool();
    await pool
      .request()
      .input('Numero', sql.VarChar(20), String(numero))
      .query(`UPDATE dbo.RecibosIngresos SET Estado = 'anulado' WHERE Numero = @Numero`);
    return this.obtener(numero);
  }

  async _cargarDetalle(pool, row) {
    const formasPago = (
      await pool
        .request()
        .input('ReciboId', sql.Int, row.ReciboId)
        .query('SELECT Tipo AS tipo, Monto AS monto, Referencia AS referencia, Banco AS banco FROM dbo.ReciboFormasPago WHERE ReciboId = @ReciboId')
    ).recordset;

    const aplicaciones = (
      await pool
        .request()
        .input('ReciboId', sql.Int, row.ReciboId)
        .query('SELECT NroFact AS nroFact, MontoAplicado AS montoAplicado FROM dbo.ReciboAplicaciones WHERE ReciboId = @ReciboId')
    ).recordset;

    const asientoRow = (
      await pool
        .request()
        .input('ReciboId', sql.Int, row.ReciboId)
        .query('SELECT TOP 1 AsientoId, Fecha, Descripcion FROM dbo.AsientosContables WHERE ReciboId = @ReciboId')
    ).recordset[0];

    let asiento = null;
    if (asientoRow) {
      const lineas = (
        await pool
          .request()
          .input('AsientoId', sql.Int, asientoRow.AsientoId)
          .query('SELECT Cuenta AS cuenta, Descripcion AS descripcion, Debito AS debito, Credito AS credito FROM dbo.AsientoDetalle WHERE AsientoId = @AsientoId')
      ).recordset;
      asiento = {
        descripcion: asientoRow.Descripcion,
        fecha: asientoRow.Fecha,
        lineas,
        totalDebito: lineas.reduce((a, l) => a + Number(l.debito || 0), 0),
        totalCredito: lineas.reduce((a, l) => a + Number(l.credito || 0), 0),
      };
    }

    return new ReciboIngreso({
      numero: row.Numero,
      fecha: row.Fecha,
      codCliente: row.CodCliente,
      nombreCliente: row.NombreCliente,
      concepto: row.Concepto,
      formasPago: formasPago.map((p) => ({ ...p, monto: Number(p.monto) })),
      aplicaciones: aplicaciones.map((a) => ({ ...a, montoAplicado: Number(a.montoAplicado) })),
      montoLetras: row.MontoLetras,
      estado: row.Estado,
      usuario: row.Usuario,
      asiento,
    });
  }
}

module.exports = SqlReciboIngresoRepository;
