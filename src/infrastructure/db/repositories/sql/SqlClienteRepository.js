'use strict';

const IClienteRepository = require('../../../../domain/repositories/IClienteRepository');
const Cliente = require('../../../../domain/entities/Cliente');
const { sql, getPool } = require('../../sqlServer');

function mapDireccion(r) {
  return {
    direccionId: r.DireccionId,
    clienteId: r.ClienteId,
    direccion: r.Direccion,
    referencia: r.Referencia,
    sector: r.Sector,
    esPrincipal: Boolean(r.EsPrincipal),
  };
}

/** Repositorio de clientes sobre SQL Server. */
class SqlClienteRepository extends IClienteRepository {
  async getByTelefono(telefono) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Telefono', sql.VarChar(30), telefono)
      .execute('dbo.sp_Cliente_GetByTelefono');

    const clienteRow = result.recordsets[0][0];
    if (!clienteRow) return null;
    const direcciones = (result.recordsets[1] || []).map(mapDireccion);
    return new Cliente({
      clienteId: clienteRow.ClienteId,
      telefono: clienteRow.Telefono,
      nombre: clienteRow.Nombre,
      direcciones,
      activo: Boolean(clienteRow.Activo),
    });
  }

  async upsert({ telefono, nombre }) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Telefono', sql.VarChar(30), telefono)
      .input('Nombre', sql.NVarChar(150), nombre || null)
      .output('ClienteId', sql.Int)
      .execute('dbo.sp_Cliente_Upsert');
    const row = result.recordset[0];
    return new Cliente({
      clienteId: row.ClienteId,
      telefono: row.Telefono,
      nombre: row.Nombre,
      direcciones: [],
      activo: Boolean(row.Activo),
    });
  }

  async addDireccion(clienteId, { direccion, referencia = null, sector = null, esPrincipal = false }) {
    const pool = await getPool();
    await pool
      .request()
      .input('ClienteId', sql.Int, clienteId)
      .input('Direccion', sql.NVarChar(300), direccion)
      .input('Referencia', sql.NVarChar(200), referencia)
      .input('Sector', sql.NVarChar(120), sector)
      .input('EsPrincipal', sql.Bit, esPrincipal ? 1 : 0)
      .execute('dbo.sp_Direccion_Add');
    return this._getByClienteId(clienteId);
  }

  async _getByClienteId(clienteId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('ClienteId', sql.Int, clienteId)
      .query(
        `SELECT c.*, d.DireccionId, d.Direccion, d.Referencia, d.Sector, d.EsPrincipal
         FROM dbo.Clientes c
         LEFT JOIN dbo.Direcciones d ON d.ClienteId = c.ClienteId AND d.Activo = 1
         WHERE c.ClienteId = @ClienteId`
      );
    if (!result.recordset.length) return null;
    const first = result.recordset[0];
    const direcciones = result.recordset
      .filter((r) => r.DireccionId)
      .map(mapDireccion);
    return new Cliente({
      clienteId: first.ClienteId,
      telefono: first.Telefono,
      nombre: first.Nombre,
      direcciones,
      activo: Boolean(first.Activo),
    });
  }
}

module.exports = SqlClienteRepository;
