'use strict';

const ICuentasPorCobrarRepository = require('../../../../domain/repositories/ICuentasPorCobrarRepository');
const { sql, getPool } = require('../../sqlServer');

/**
 * Repositorio de Cuentas por Cobrar Clientes.
 *
 * Soporta dos esquemas:
 *  - legacy: tablas originales fac_enca/pagosfacturas/clientes.
 *  - pedidos: tablas actuales Pedidos/Pagos/Clientes.
 *
 * El modo 'auto' detecta qué esquema está disponible en la BD.
 */
class SqlCuentasPorCobrarRepository extends ICuentasPorCobrarRepository {
  constructor({ schema = process.env.CXC_SCHEMA || 'legacy' } = {}) {
    super();
    this.schemaOption = schema;
    this._detectedSchema = null;
  }

  async _getSchema() {
    if (this.schemaOption !== 'auto') return this.schemaOption;
    if (this._detectedSchema) return this._detectedSchema;
    const pool = await getPool();
    const result = await pool
      .request()
      .query(
        `SELECT OBJECT_ID('fac_enca', 'U') AS hasLegacy, OBJECT_ID('Pedidos', 'U') AS hasPedidos`
      );
    const { hasLegacy, hasPedidos } = result.recordset[0];
    this._detectedSchema = hasLegacy ? 'legacy' : hasPedidos ? 'pedidos' : 'legacy';
    return this._detectedSchema;
  }

  /** Consulta facturas a crédito con balance > 0. */
  async listarFacturas(filtro = {}) {
    const schema = await this._getSchema();
    return schema === 'pedidos'
      ? this._listarPedidos(filtro)
      : this._listarLegacy(filtro);
  }

  async _listarLegacy(filtro) {
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

  async _listarPedidos(filtro) {
    const pool = await getPool();
    const request = pool.request();

    let query = `
      SELECT
        p.PedidoId,
        CAST(p.Creado AS DATE) AS fechaFact,
        p.ClienteId,
        c.Nombre AS nombreCliente,
        p.Subtotal,
        p.Envio,
        p.Itbis,
        p.Total,
        p.FormaPago,
        ISNULL(SUM(CASE WHEN pg.Estado = 'pagado' THEN pg.Monto ELSE 0 END), 0) AS abono
      FROM dbo.Pedidos p
      INNER JOIN dbo.Clientes c ON c.ClienteId = p.ClienteId
      LEFT JOIN dbo.Pagos pg ON pg.PedidoId = p.PedidoId
      WHERE p.FormaPago = @formaPago
        AND p.EstadoId = 5
      GROUP BY p.PedidoId, p.Creado, p.ClienteId, c.Nombre, p.Subtotal, p.Envio, p.Itbis, p.Total, p.FormaPago
      HAVING p.Total - ISNULL(SUM(CASE WHEN pg.Estado = 'pagado' THEN pg.Monto ELSE 0 END), 0) > 0
    `;

    request.input('formaPago', sql.VarChar(30), filtro.formaPago || 'contraentrega');

    if (filtro.codCliente) {
      const id = this._clienteId(filtro.codCliente);
      if (id) {
        query += ' AND p.ClienteId = @clienteId';
        request.input('clienteId', sql.Int, id);
      } else {
        query += ' AND c.Nombre LIKE @nombreCliente';
        request.input('nombreCliente', sql.NVarChar(150), `%${filtro.codCliente}%`);
      }
    }

    if (filtro.fechaDesde && filtro.fechaHasta) {
      query += ' AND CAST(p.Creado AS DATE) BETWEEN @fechaDesde AND @fechaHasta';
      request.input('fechaDesde', sql.Date, new Date(filtro.fechaDesde));
      request.input('fechaHasta', sql.Date, new Date(filtro.fechaHasta));
    }

    query += this._ordenPedidos(filtro.orden);

    const result = await request.query(query);
    const facturas = result.recordset.map((r) => this._mapPedido(r));

    if (filtro.diasMin != null && filtro.diasMax != null) {
      return facturas.filter(
        (f) => f.diasVencido >= filtro.diasMin && f.diasVencido <= filtro.diasMax
      );
    }
    return facturas;
  }

  _ordenPedidos(orden) {
    const map = {
      codigo: 'ORDER BY p.ClienteId, p.Creado',
      nombre: 'ORDER BY c.Nombre, p.Creado',
      fecha: 'ORDER BY p.Creado',
      factura: 'ORDER BY p.PedidoId',
      tipo: 'ORDER BY p.FormaPago, p.Creado',
    };
    return map[orden] || 'ORDER BY c.Nombre, p.Creado';
  }

  _clienteId(cod) {
    const s = String(cod).trim();
    if (s.toUpperCase().startsWith('C')) return Number(s.slice(1)) || null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  _pedidoId(nro) {
    const s = String(nro).trim();
    if (s.toUpperCase().startsWith('P')) return Number(s.slice(1)) || null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  /** Suma los abonos registrados para una factura. */
  async sumarPagos(nroFact) {
    const schema = await this._getSchema();
    if (schema === 'pedidos') {
      const pedidoId = this._pedidoId(nroFact);
      if (!pedidoId) return 0;
      const pool = await getPool();
      const result = await pool
        .request()
        .input('pedidoId', sql.Int, pedidoId)
        .query(
          `SELECT ISNULL(SUM(Monto), 0) AS total FROM dbo.Pagos WHERE PedidoId = @pedidoId AND Estado = 'pagado'`
        );
      return Number(result.recordset[0].total) || 0;
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input('nroFact', sql.VarChar(30), String(nroFact))
      .query('SELECT ISNULL(SUM(abono), 0) AS total FROM pagosfacturas WHERE num_fact = @nroFact');
    return Number(result.recordset[0].total) || 0;
  }

  /** Datos básicos de un cliente por su código. */
  async obtenerCliente(codCliente) {
    const schema = await this._getSchema();
    if (schema === 'pedidos') {
      const id = this._clienteId(codCliente);
      if (!id) return null;
      const pool = await getPool();
      const result = await pool
        .request()
        .input('clienteId', sql.Int, id)
        .query('SELECT ClienteId AS codigo, Nombre AS nombre, Telefono AS correo FROM dbo.Clientes WHERE ClienteId = @clienteId');
      return result.recordset[0] || null;
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input('codCliente', sql.VarChar(30), codCliente)
      .query('SELECT cli_codigo AS codigo, cli_nombre AS nombre, otrochofer AS correo FROM clientes WHERE cli_codigo = @codCliente');
    return result.recordset[0] || null;
  }

  /** Total de facturas a crédito con balance > 0 de un cliente. */
  async balancePorCliente(codCliente) {
    const schema = await this._getSchema();
    if (schema === 'pedidos') {
      const id = this._clienteId(codCliente);
      if (!id) return 0;
      const pool = await getPool();
      const result = await pool
        .request()
        .input('clienteId', sql.Int, id)
        .input('formaPago', sql.VarChar(30), 'contraentrega')
        .query(
          `SELECT ISNULL(SUM(p.Total - ISNULL(pg.total, 0)), 0) AS balance
           FROM dbo.Pedidos p
           LEFT JOIN (
             SELECT PedidoId, SUM(Monto) AS total FROM dbo.Pagos WHERE Estado = 'pagado' GROUP BY PedidoId
           ) pg ON pg.PedidoId = p.PedidoId
           WHERE p.ClienteId = @clienteId AND p.FormaPago = @formaPago AND p.EstadoId = 5`
        );
      return Number(result.recordset[0].balance) || 0;
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input('codCliente', sql.VarChar(30), codCliente)
      .input('formaPago', sql.VarChar(10), 'C')
      .query(
        `SELECT ISNULL(SUM(bal_fact), 0) AS balance
        FROM fac_enca
        WHERE cod_cliente = @codCliente AND forma_pago = @formaPago AND bal_fact > 0`
      );
    return Number(result.recordset[0].balance) || 0;
  }

  /** Registra un abono y actualiza el balance. */
  async registrarAbono(nroFact, { monto, fecha = new Date(), metodo = 'ABONO', referencia = null }) {
    const schema = await this._getSchema();
    if (schema === 'pedidos') {
      const pedidoId = this._pedidoId(nroFact);
      if (!pedidoId) throw new Error(`Número de factura/pedido inválido: ${nroFact}`);
      const pool = await getPool();
      const result = await pool
        .request()
        .input('PedidoId', sql.Int, pedidoId)
        .input('Metodo', sql.VarChar(30), metodo)
        .input('Monto', sql.Decimal(12, 2), monto)
        .input('Referencia', sql.NVarChar(120), referencia)
        .input('Estado', sql.VarChar(20), 'pagado')
        .execute('dbo.sp_Pago_Registrar');
      const r = result.recordset[0];
      return { nroFact, pagoId: r.PagoId, monto, fecha };
    }

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();
      const req = new sql.Request(transaction);
      await req
        .input('nroFact', sql.VarChar(30), String(nroFact))
        .input('monto', sql.Decimal(12, 2), monto)
        .input('fecha', sql.DateTime, new Date(fecha))
        .input('metodo', sql.VarChar(30), metodo)
        .input('referencia', sql.VarChar(60), referencia)
        .query(
          `INSERT INTO pagosfacturas (num_fact, abono, fecha, metodo, referencia)
           VALUES (@nroFact, @monto, @fecha, @metodo, @referencia)`
        );

      const req2 = new sql.Request(transaction);
      await req2
        .input('nroFact', sql.VarChar(30), String(nroFact))
        .query(
          `UPDATE fac_enca
           SET abono_EN_RECIBO = (SELECT ISNULL(SUM(abono), 0) FROM pagosfacturas WHERE num_fact = @nroFact),
               bal_fact = neto - (SELECT ISNULL(SUM(abono), 0) FROM pagosfacturas WHERE num_fact = @nroFact)
               - (SELECT ISNULL(SUM(devolucion), 0) FROM fac_enca WHERE nro_fact = @nroFact)
               - (SELECT ISNULL(SUM(descto_pago), 0) FROM fac_enca WHERE nro_fact = @nroFact)
           WHERE nro_fact = @nroFact`
        );

      await transaction.commit();
      return { nroFact, monto, fecha };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
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

  _mapPedido(r) {
    const nroFact = `P${r.PedidoId}`;
    const fechaFact = r.fechaFact instanceof Date ? r.fechaFact.toISOString().split('T')[0] : r.fechaFact;
    const neto = Number(r.Total) || 0;
    const abono = Number(r.abono) || 0;
    const balFact = neto - abono;
    return {
      nroFact,
      fechaFact,
      codCliente: `C${r.ClienteId}`,
      nombreCliente: r.nombreCliente,
      montoTotal: neto,
      descuento: 0,
      itebis: Number(r.Itbis) || 0,
      neto,
      abono,
      devolucion: 0,
      desctoPago: 0,
      balFact: balFact < 0 ? 0 : balFact,
      plazo: 30,
      ncf: '',
      vendedor: '',
      tipoCliente: r.FormaPago,
      diasVencido: this._diasVencido(fechaFact),
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
