/* =====================================================================
   WHATSAPP COLMADO - Archivo 02: Índices
   ===================================================================== */
USE ColmadoDB;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Productos_Categoria')
    CREATE INDEX IX_Productos_Categoria ON dbo.Productos (CategoriaId) WHERE Activo = 1;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Productos_Nombre')
    CREATE INDEX IX_Productos_Nombre ON dbo.Productos (Nombre);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pedidos_Cliente')
    CREATE INDEX IX_Pedidos_Cliente ON dbo.Pedidos (ClienteId, Creado DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pedidos_Estado')
    CREATE INDEX IX_Pedidos_Estado ON dbo.Pedidos (EstadoId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Detalle_Pedido')
    CREATE INDEX IX_Detalle_Pedido ON dbo.PedidosDetalle (PedidoId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Direcciones_Cliente')
    CREATE INDEX IX_Direcciones_Cliente ON dbo.Direcciones (ClienteId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Ofertas_Vigencia')
    CREATE INDEX IX_Ofertas_Vigencia ON dbo.Ofertas (FechaInicio, FechaFin) WHERE Activo = 1;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Logs_Creado')
    CREATE INDEX IX_Logs_Creado ON dbo.Logs (Creado DESC);
GO

PRINT 'Índices creados correctamente.';
GO
