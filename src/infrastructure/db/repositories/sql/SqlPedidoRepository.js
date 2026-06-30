'use strict';

const IPedidoRepository = require('../../../../domain/repositories/IPedidoRepository');
const Pedido = require('../../../../domain/entities/Pedido');
const { sql, getPool } = require('../../sqlServer');

function mapPedido(resumen, detalle = [], pagos = []) {
  return new Pedido({
    pedidoId: resumen.PedidoId,
    clienteId: resumen.ClienteId,
    estadoId: resumen.EstadoId,
    subtotal: resumen.Subtotal,
    envio: resumen.Envio,
    itbis: resumen.Itbis,
    total: resumen.Total,
    formaPago: resumen.FormaPago,
    tiempoEstimadoMin: resumen.TiempoEstimadoMin,
    creado: resumen.Creado,
    cliente: { nombre: resumen.Cliente, telefono: resumen.Telefono, direccion: resumen.Direccion },
    items: detalle.map((d) => ({
      productoId: d.ProductoId,
      descripcion: d.Descripcion,
      cantidad: d.Cantidad,
      precioUnit: d.PrecioUnit,
      importe: d.Importe,
    })),
    pagos,
  });
}

/** Repositorio de pedidos sobre SQL Server (transaccional vía sp_Pedido_Crear). */
class SqlPedidoRepository extends IPedidoRepository {
  async crear({ clienteId, direccionId = null, items, envio = 0, itbisRate = 0, formaPago = null, notas = null }) {
    const pool = await getPool();
    const detalleJson = JSON.stringify(
      items.map((i) => ({
        ProductoId: i.productoId,
        Descripcion: i.descripcion,
        Cantidad: i.cantidad,
        PrecioUnit: i.precioUnit,
      }))
    );
    const result = await pool
      .request()
      .input('ClienteId', sql.Int, clienteId)
      .input('DireccionId', sql.Int, direccionId)
      .input('Envio', sql.Decimal(12, 2), envio)
      .input('ItbisRate', sql.Decimal(5, 4), itbisRate)
      .input('FormaPago', sql.VarChar(30), formaPago)
      .input('Notas', sql.NVarChar(400), notas)
      .input('Detalle', sql.NVarChar(sql.MAX), detalleJson)
      .output('PedidoId', sql.Int)
      .execute('dbo.sp_Pedido_Crear');
    const resumen = result.recordset[0];
    return this.getById(resumen.PedidoId);
  }

  async getById(pedidoId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('PedidoId', sql.Int, pedidoId)
      .execute('dbo.sp_Pedido_Get');
    const resumen = result.recordsets[0][0];
    if (!resumen) return null;
    return mapPedido(resumen, result.recordsets[1] || [], result.recordsets[2] || []);
  }

  async cambiarEstado(pedidoId, estadoId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('PedidoId', sql.Int, pedidoId)
      .input('EstadoId', sql.Int, estadoId)
      .execute('dbo.sp_Pedido_CambiarEstado');
    const resumen = result.recordset[0];
    return resumen ? mapPedido(resumen) : null;
  }

  async ultimoDeCliente(clienteId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('ClienteId', sql.Int, clienteId)
      .execute('dbo.sp_Pedido_Ultimo');
    const resumen = result.recordsets[0] && result.recordsets[0][0];
    if (!resumen) return null;
    return mapPedido(resumen, result.recordsets[1] || [], result.recordsets[2] || []);
  }

  async registrarPago(pedidoId, { metodo, monto, referencia = null, estado = 'pendiente' }) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('PedidoId', sql.Int, pedidoId)
      .input('Metodo', sql.VarChar(30), metodo)
      .input('Monto', sql.Decimal(12, 2), monto)
      .input('Referencia', sql.NVarChar(120), referencia)
      .input('Estado', sql.VarChar(20), estado)
      .execute('dbo.sp_Pago_Registrar');
    const r = result.recordset[0];
    return { pagoId: r.PagoId, pedidoId: r.PedidoId, metodo: r.Metodo, monto: r.Monto, estado: r.Estado };
  }

  async list(filtro = {}) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('EstadoId', sql.Int, filtro.estadoId || null)
      .input('ClienteId', sql.Int, filtro.clienteId || null)
      .query(
        `SELECT TOP 100 * FROM dbo.vw_PedidosResumen
         WHERE (@EstadoId IS NULL OR EstadoId = @EstadoId)
           AND (@ClienteId IS NULL OR ClienteId = @ClienteId)
         ORDER BY Creado DESC`
      );
    return result.recordset.map((r) => mapPedido(r));
  }
}

module.exports = SqlPedidoRepository;
