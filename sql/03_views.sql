/* =====================================================================
   WHATSAPP COLMADO - Archivo 03: Vistas
   ===================================================================== */
USE ColmadoDB;
GO

/* Catálogo con categoría, stock y precio efectivo (oferta vigente si existe) */
IF OBJECT_ID('dbo.vw_Catalogo', 'V') IS NOT NULL DROP VIEW dbo.vw_Catalogo;
GO
CREATE VIEW dbo.vw_Catalogo AS
SELECT
    p.ProductoId,
    p.Nombre,
    p.Marca,
    p.Presentacion,
    p.Unidad,
    p.Tamano,
    p.Precio,
    c.CategoriaId,
    c.Nombre              AS Categoria,
    ISNULL(i.Existencia, 0) AS Existencia,
    CAST(CASE WHEN ISNULL(i.Existencia, 0) > 0 THEN 1 ELSE 0 END AS BIT) AS Disponible,
    o.PrecioOferta,
    CAST(CASE WHEN o.OfertaId IS NOT NULL THEN o.PrecioOferta ELSE p.Precio END AS DECIMAL(12,2)) AS PrecioEfectivo,
    p.ImagenUrl,
    p.Palabras,
    p.Activo
FROM dbo.Productos p
INNER JOIN dbo.Categorias c   ON c.CategoriaId = p.CategoriaId
LEFT  JOIN dbo.Inventario i   ON i.ProductoId = p.ProductoId
OUTER APPLY (
    SELECT TOP 1 of.OfertaId, of.PrecioOferta
    FROM dbo.Ofertas of
    WHERE of.ProductoId = p.ProductoId
      AND of.Activo = 1
      AND CAST(SYSUTCDATETIME() AS DATE) BETWEEN of.FechaInicio AND of.FechaFin
    ORDER BY of.PrecioOferta ASC
) o;
GO

/* Resumen de pedidos con cliente, estado y dirección */
IF OBJECT_ID('dbo.vw_PedidosResumen', 'V') IS NOT NULL DROP VIEW dbo.vw_PedidosResumen;
GO
CREATE VIEW dbo.vw_PedidosResumen AS
SELECT
    ped.PedidoId,
    ped.Creado,
    ped.EstadoId,
    e.Nombre        AS Estado,
    cli.ClienteId,
    cli.Nombre      AS Cliente,
    cli.Telefono,
    dir.Direccion,
    dir.Sector,
    ped.Subtotal,
    ped.Envio,
    ped.Itbis,
    ped.Total,
    ped.FormaPago,
    ped.TiempoEstimadoMin
FROM dbo.Pedidos ped
INNER JOIN dbo.Clientes cli       ON cli.ClienteId = ped.ClienteId
INNER JOIN dbo.EstadosPedidos e   ON e.EstadoId = ped.EstadoId
LEFT  JOIN dbo.Direcciones dir    ON dir.DireccionId = ped.DireccionId;
GO

PRINT 'Vistas creadas correctamente.';
GO
