'use strict';

const IProductoRepository = require('../../../../domain/repositories/IProductoRepository');
const Producto = require('../../../../domain/entities/Producto');
const { sql, getPool } = require('../../sqlServer');

function mapProducto(row) {
  return new Producto({
    productoId: row.ProductoId,
    nombre: row.Nombre,
    marca: row.Marca,
    presentacion: row.Presentacion,
    unidad: row.Unidad,
    tamano: row.Tamano,
    precio: row.Precio,
    precioEfectivo: row.PrecioEfectivo,
    categoria: row.Categoria,
    categoriaId: row.CategoriaId,
    existencia: row.Existencia,
    disponible: row.Disponible,
    imagenUrl: row.ImagenUrl,
    palabras: row.Palabras,
  });
}

/** Repositorio de productos sobre SQL Server (usa stored procedures). */
class SqlProductoRepository extends IProductoRepository {
  async list(categoria = null) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Categoria', sql.NVarChar(80), categoria)
      .execute('dbo.sp_Catalogo_List');
    return result.recordset.map(mapProducto);
  }

  async getById(productoId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('ProductoId', sql.Int, productoId)
      .query('SELECT * FROM dbo.vw_Catalogo WHERE ProductoId = @ProductoId');
    return result.recordset[0] ? mapProducto(result.recordset[0]) : null;
  }

  async buscar(texto) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('Texto', sql.NVarChar(150), texto)
      .execute('dbo.sp_Producto_Buscar');
    return result.recordset.map(mapProducto);
  }

  async listCategorias() {
    const pool = await getPool();
    const result = await pool
      .request()
      .query('SELECT CategoriaId, Nombre FROM dbo.Categorias WHERE Activo = 1 ORDER BY Orden');
    return result.recordset.map((r) => ({ categoriaId: r.CategoriaId, nombre: r.Nombre }));
  }

  async listOfertas() {
    const pool = await getPool();
    const result = await pool.request().execute('dbo.sp_Ofertas_Vigentes');
    return result.recordset.map((r) => ({
      ofertaId: r.OfertaId,
      productoId: r.ProductoId,
      nombre: r.Nombre,
      descripcion: r.Descripcion,
      precioRegular: r.PrecioRegular,
      precioOferta: r.PrecioOferta,
    }));
  }
}

module.exports = SqlProductoRepository;
