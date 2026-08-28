'use strict';

const { sql, getPool } = require('../../sqlServer');

/**
 * Repositorio de Cuentas por Cobrar Clientes.
 *
 * Lee de las tablas legacy del sistema original (fac_enca, pagosfacturas,
 * clientes, vendedores). Requiere que esas tablas existan en la base de
 * datos configurada (DB_DRIVER=mssql).
 */
class SqlCuentasPorCobrarRepository {
  /** Consulta facturas a crédito con balance > 0 y no anuladas. */
  async listarFacturas(filtro = {}) {
    const pool = await getPool();

    const ordenMap = {
      codigo: 'cod_cliente',
      nombre: 'nombrecliente',
      fecha: 'fecha_fact',
      factura: 'nro_fact',
      tipo: 'tipocliente',
    };
    const ordenarPor = ordenMap[filtro.orden] || 'nombrecliente, fecha_fact';

    const request = pool.request();
    let query = `
      SELECT
        nro_fact AS nroFact,
        fecha_fact AS fechaFact,
        cod_cliente AS codCliente,
        nombrecliente AS nombreCliente,
        monto_total AS montoTotal,
        descuento,
        itebis,
        neto,
        abono_EN_RECIBO AS abono,
        devolucion,
        descto_pago AS desctoPago,
        bal_fact AS balFact,
        plazo_2 AS plazo,
        NCF,
        VENDEDOR_2 AS vendedor,
        tipocliente,
        dias_vencimiento AS diasVencido
      FROM fac_enca
      WHERE forma_pago = @formaPago
        AND bal_fact > 0
        AND COALESCE(marca, '') <> 'ANULADA'
    `;

    request.input('formaPago', sql.VarChar(10), filtro.formaPago || 'C');

    if (filtro.codCliente) {
      query += ' AND cod_cliente = @codCliente';
      request.input('codCliente', sql.VarChar(30), filtro.codCliente);
    }

    if (filtro.vendedor) {
      query += ' AND VENDEDOR_2 = @vendedor';
      request.input('vendedor', sql.VarChar(30), filtro.vendedor);
    }

    if (filtro.fechaDesde && filtro.fechaHasta) {
      query += ' AND fecha_fact BETWEEN @fechaDesde AND @fechaHasta';
      request.input('fechaDesde', sql.DateTime, new Date(filtro.fechaDesde));
      request.input('fechaHasta', sql.DateTime, new Date(filtro.fechaHasta));
    }

    if (filtro.diasMin != null && filtro.diasMax != null) {
      query += ' AND dias_vencimiento BETWEEN @diasMin AND @diasMax';
      request.input('diasMin', sql.Int, filtro.diasMin);
      request.input('diasMax', sql.Int, filtro.diasMax);
    }

    query += ` ORDER BY ${ordenarPor}`;

    const result = await request.query(query);
    return result.recordset.map((r) => this._mapFactura(r));
  }

  /** Suma los abonos registrados en pagosfacturas para una factura. */
  async sumarPagos(nroFact) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('nroFact', sql.VarChar(30), String(nroFact))
      .query('SELECT ISNULL(SUM(abono), 0) AS total FROM pagosfacturas WHERE num_fact = @nroFact');
    return Number(result.recordset[0].total) || 0;
  }

  /** Datos básicos de un cliente por su código. */
  async obtenerCliente(codCliente) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('codCliente', sql.VarChar(30), codCliente)
      .query('SELECT cli_codigo AS codigo, cli_nombre AS nombre, otrochofer AS correo FROM clientes WHERE cli_codigo = @codCliente');
    return result.recordset[0] || null;
  }

  /** Total de facturas a crédito con balance > 0 de un cliente. */
  async balancePorCliente(codCliente) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('codCliente', sql.VarChar(30), codCliente)
      .input('formaPago', sql.VarChar(10), 'C')
      .query(`
        SELECT ISNULL(SUM(bal_fact), 0) AS balance
        FROM fac_enca
        WHERE cod_cliente = @codCliente AND forma_pago = @formaPago AND bal_fact > 0
      `);
    return Number(result.recordset[0].balance) || 0;
  }

  _mapFactura(r) {
    return {
      nroFact: r.nroFact,
      fechaFact: r.fechaFact,
      codCliente: r.codCliente,
      nombreCliente: r.nombreCliente,
      montoTotal: Number(r.montoTotal) || 0,
      descuento: Number(r.descuento) || 0,
      itebis: Number(r.itebis) || 0,
      neto: Number(r.neto) || 0,
      abono: Number(r.abono) || 0,
      devolucion: Number(r.devolucion) || 0,
      desctoPago: Number(r.desctoPago) || 0,
      balFact: Number(r.balFact) || 0,
      plazo: r.plazo,
      ncf: r.NCF,
      vendedor: r.vendedor,
      tipoCliente: r.tipocliente,
      diasVencido: r.diasVencido != null ? Number(r.diasVencido) : this._diasVencido(r.fechaFact),
    };
  }

  _diasVencido(fechaFact) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fec = new Date(fechaFact);
    fec.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((hoy - fec) / (1000 * 60 * 60 * 24)));
  }
}

module.exports = SqlCuentasPorCobrarRepository;
