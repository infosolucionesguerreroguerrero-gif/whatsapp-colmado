/* =====================================================================
   WHATSAPP COLMADO - Archivo 05: Triggers
   ===================================================================== */
USE ColmadoDB;
GO

/* Registrar en historial cada cambio de estado del pedido */
IF OBJECT_ID('dbo.trg_Pedidos_Estado', 'TR') IS NOT NULL DROP TRIGGER dbo.trg_Pedidos_Estado;
GO
CREATE TRIGGER dbo.trg_Pedidos_Estado
ON dbo.Pedidos
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.PedidoEstadoHistorial (PedidoId, EstadoId)
    SELECT i.PedidoId, i.EstadoId
    FROM inserted i
    LEFT JOIN deleted d ON d.PedidoId = i.PedidoId
    WHERE d.PedidoId IS NULL          -- INSERT
       OR d.EstadoId <> i.EstadoId;   -- cambió el estado
END
GO

/* Mantener Pedidos.Actualizado al modificar (defensa adicional) */
IF OBJECT_ID('dbo.trg_Pedidos_Touch', 'TR') IS NOT NULL DROP TRIGGER dbo.trg_Pedidos_Touch;
GO
CREATE TRIGGER dbo.trg_Pedidos_Touch
ON dbo.Pedidos
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(Actualizado)
        UPDATE p SET Actualizado = SYSUTCDATETIME()
        FROM dbo.Pedidos p
        INNER JOIN inserted i ON i.PedidoId = p.PedidoId;
END
GO

/* Crear fila de inventario automáticamente al insertar un producto */
IF OBJECT_ID('dbo.trg_Productos_Inventario', 'TR') IS NOT NULL DROP TRIGGER dbo.trg_Productos_Inventario;
GO
CREATE TRIGGER dbo.trg_Productos_Inventario
ON dbo.Productos
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Inventario (ProductoId, Existencia, StockMinimo)
    SELECT i.ProductoId, 0, 0
    FROM inserted i
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Inventario inv WHERE inv.ProductoId = i.ProductoId);
END
GO

/* Auditar stock bajo en Logs cuando la existencia cae por debajo del mínimo */
IF OBJECT_ID('dbo.trg_Inventario_StockBajo', 'TR') IS NOT NULL DROP TRIGGER dbo.trg_Inventario_StockBajo;
GO
CREATE TRIGGER dbo.trg_Inventario_StockBajo
ON dbo.Inventario
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Logs (Nivel, Origen, Mensaje, Datos)
    SELECT 'warn', 'db',
           CONCAT('Stock bajo para producto ', i.ProductoId),
           (SELECT i.ProductoId, i.Existencia, i.StockMinimo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i
    WHERE i.Existencia <= i.StockMinimo AND i.StockMinimo > 0;
END
GO

PRINT 'Triggers creados correctamente.';
GO
