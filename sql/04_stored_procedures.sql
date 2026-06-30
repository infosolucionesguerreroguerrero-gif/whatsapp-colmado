/* =====================================================================
   WHATSAPP COLMADO - Archivo 04: Stored Procedures
   ===================================================================== */
USE ColmadoDB;
GO

/* ---- Cliente: obtener por teléfono ---- */
IF OBJECT_ID('dbo.sp_Cliente_GetByTelefono', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_Cliente_GetByTelefono;
GO
CREATE PROCEDURE dbo.sp_Cliente_GetByTelefono
    @Telefono VARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 1 * FROM dbo.Clientes WHERE Telefono = @Telefono AND Activo = 1;

    SELECT * FROM dbo.Direcciones d
    INNER JOIN dbo.Clientes c ON c.ClienteId = d.ClienteId
    WHERE c.Telefono = @Telefono AND d.Activo = 1
    ORDER BY d.EsPrincipal DESC, d.DireccionId ASC;
END
GO

/* ---- Cliente: crear o actualizar (upsert) ---- */
IF OBJECT_ID('dbo.sp_Cliente_Upsert', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_Cliente_Upsert;
GO
CREATE PROCEDURE dbo.sp_Cliente_Upsert
    @Telefono VARCHAR(30),
    @Nombre   NVARCHAR(150) = NULL,
    @ClienteId INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT @ClienteId = ClienteId FROM dbo.Clientes WHERE Telefono = @Telefono;

    IF @ClienteId IS NULL
    BEGIN
        INSERT INTO dbo.Clientes (Telefono, Nombre) VALUES (@Telefono, @Nombre);
        SET @ClienteId = SCOPE_IDENTITY();
    END
    ELSE IF @Nombre IS NOT NULL
    BEGIN
        UPDATE dbo.Clientes SET Nombre = @Nombre WHERE ClienteId = @ClienteId;
    END

    SELECT * FROM dbo.Clientes WHERE ClienteId = @ClienteId;
END
GO

/* ---- Dirección: agregar ---- */
IF OBJECT_ID('dbo.sp_Direccion_Add', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_Direccion_Add;
GO
CREATE PROCEDURE dbo.sp_Direccion_Add
    @ClienteId   INT,
    @Direccion   NVARCHAR(300),
    @Referencia  NVARCHAR(200) = NULL,
    @Sector      NVARCHAR(120) = NULL,
    @EsPrincipal BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    IF @EsPrincipal = 1
        UPDATE dbo.Direcciones SET EsPrincipal = 0 WHERE ClienteId = @ClienteId;

    INSERT INTO dbo.Direcciones (ClienteId, Direccion, Referencia, Sector, EsPrincipal)
    VALUES (@ClienteId, @Direccion, @Referencia, @Sector, @EsPrincipal);

    SELECT * FROM dbo.Direcciones WHERE DireccionId = SCOPE_IDENTITY();
END
GO

/* ---- Catálogo: listar por categoría (o todo) ---- */
IF OBJECT_ID('dbo.sp_Catalogo_List', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_Catalogo_List;
GO
CREATE PROCEDURE dbo.sp_Catalogo_List
    @Categoria NVARCHAR(80) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM dbo.vw_Catalogo
    WHERE Activo = 1
      AND (@Categoria IS NULL OR Categoria = @Categoria)
    ORDER BY Categoria, Nombre;
END
GO

/* ---- Catálogo: búsqueda por texto (para NLU) ---- */
IF OBJECT_ID('dbo.sp_Producto_Buscar', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_Producto_Buscar;
GO
CREATE PROCEDURE dbo.sp_Producto_Buscar
    @Texto NVARCHAR(150)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 25 *
    FROM dbo.vw_Catalogo
    WHERE Activo = 1
      AND (
            Nombre LIKE '%' + @Texto + '%'
         OR ISNULL(Marca,'') LIKE '%' + @Texto + '%'
         OR ISNULL(Palabras,'') LIKE '%' + @Texto + '%'
      )
    ORDER BY
        CASE WHEN Nombre LIKE @Texto + '%' THEN 0 ELSE 1 END,
        Nombre;
END
GO

/* ---- Ofertas vigentes ---- */
IF OBJECT_ID('dbo.sp_Ofertas_Vigentes', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_Ofertas_Vigentes;
GO
CREATE PROCEDURE dbo.sp_Ofertas_Vigentes
AS
BEGIN
    SET NOCOUNT ON;
    SELECT o.OfertaId, o.Descripcion, o.PrecioOferta, o.FechaInicio, o.FechaFin,
           p.ProductoId, p.Nombre, p.Precio AS PrecioRegular
    FROM dbo.Ofertas o
    INNER JOIN dbo.Productos p ON p.ProductoId = o.ProductoId
    WHERE o.Activo = 1
      AND CAST(SYSUTCDATETIME() AS DATE) BETWEEN o.FechaInicio AND o.FechaFin
    ORDER BY o.PrecioOferta;
END
GO

/* ---- Pedido: crear cabecera + detalle (transaccional con control de stock) ----
   @Detalle es un JSON: [{"ProductoId":1,"Descripcion":"...","Cantidad":2,"PrecioUnit":120}] */
IF OBJECT_ID('dbo.sp_Pedido_Crear', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_Pedido_Crear;
GO
CREATE PROCEDURE dbo.sp_Pedido_Crear
    @ClienteId   INT,
    @DireccionId INT = NULL,
    @Envio       DECIMAL(12,2) = 0,
    @ItbisRate   DECIMAL(5,4) = 0,
    @FormaPago   VARCHAR(30) = NULL,
    @Notas       NVARCHAR(400) = NULL,
    @Detalle     NVARCHAR(MAX),
    @PedidoId    INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @items TABLE (
            ProductoId  INT,
            Descripcion NVARCHAR(200),
            Cantidad    DECIMAL(12,2),
            PrecioUnit  DECIMAL(12,2)
        );

        INSERT INTO @items (ProductoId, Descripcion, Cantidad, PrecioUnit)
        SELECT ProductoId, Descripcion, Cantidad, PrecioUnit
        FROM OPENJSON(@Detalle)
        WITH (
            ProductoId  INT           '$.ProductoId',
            Descripcion NVARCHAR(200) '$.Descripcion',
            Cantidad    DECIMAL(12,2) '$.Cantidad',
            PrecioUnit  DECIMAL(12,2) '$.PrecioUnit'
        );

        IF NOT EXISTS (SELECT 1 FROM @items)
            THROW 50001, 'El pedido no contiene productos.', 1;

        DECLARE @Subtotal DECIMAL(12,2) = (SELECT SUM(Cantidad * PrecioUnit) FROM @items);
        DECLARE @Itbis    DECIMAL(12,2) = CAST(@Subtotal * @ItbisRate AS DECIMAL(12,2));
        DECLARE @Total    DECIMAL(12,2) = @Subtotal + @Envio + @Itbis;

        INSERT INTO dbo.Pedidos (ClienteId, DireccionId, EstadoId, Subtotal, Envio, Itbis, Total, FormaPago, Notas)
        VALUES (@ClienteId, @DireccionId, 1, @Subtotal, @Envio, @Itbis, @Total, @FormaPago, @Notas);

        SET @PedidoId = SCOPE_IDENTITY();

        INSERT INTO dbo.PedidosDetalle (PedidoId, ProductoId, Descripcion, Cantidad, PrecioUnit)
        SELECT @PedidoId, ProductoId, Descripcion, Cantidad, PrecioUnit FROM @items;

        -- Descontar inventario (control de concurrencia por UPDATE atómico)
        UPDATE inv
        SET inv.Existencia = inv.Existencia - it.Cantidad,
            inv.Actualizado = SYSUTCDATETIME()
        FROM dbo.Inventario inv
        INNER JOIN @items it ON it.ProductoId = inv.ProductoId;

        COMMIT TRANSACTION;

        SELECT * FROM dbo.vw_PedidosResumen WHERE PedidoId = @PedidoId;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

/* ---- Pedido: cambiar estado ---- */
IF OBJECT_ID('dbo.sp_Pedido_CambiarEstado', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_Pedido_CambiarEstado;
GO
CREATE PROCEDURE dbo.sp_Pedido_CambiarEstado
    @PedidoId INT,
    @EstadoId INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Pedidos
    SET EstadoId = @EstadoId, Actualizado = SYSUTCDATETIME()
    WHERE PedidoId = @PedidoId;

    SELECT * FROM dbo.vw_PedidosResumen WHERE PedidoId = @PedidoId;
END
GO

/* ---- Pedido: obtener con detalle ---- */
IF OBJECT_ID('dbo.sp_Pedido_Get', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_Pedido_Get;
GO
CREATE PROCEDURE dbo.sp_Pedido_Get
    @PedidoId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM dbo.vw_PedidosResumen WHERE PedidoId = @PedidoId;
    SELECT * FROM dbo.PedidosDetalle WHERE PedidoId = @PedidoId;
    SELECT * FROM dbo.Pagos WHERE PedidoId = @PedidoId;
END
GO

/* ---- Pedido: último de un cliente (para "repetir pedido") ---- */
IF OBJECT_ID('dbo.sp_Pedido_Ultimo', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_Pedido_Ultimo;
GO
CREATE PROCEDURE dbo.sp_Pedido_Ultimo
    @ClienteId INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @PedidoId INT = (
        SELECT TOP 1 PedidoId FROM dbo.Pedidos
        WHERE ClienteId = @ClienteId
        ORDER BY Creado DESC
    );
    IF @PedidoId IS NOT NULL
        EXEC dbo.sp_Pedido_Get @PedidoId;
END
GO

/* ---- Pago: registrar ---- */
IF OBJECT_ID('dbo.sp_Pago_Registrar', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_Pago_Registrar;
GO
CREATE PROCEDURE dbo.sp_Pago_Registrar
    @PedidoId   INT,
    @Metodo     VARCHAR(30),
    @Monto      DECIMAL(12,2),
    @Referencia NVARCHAR(120) = NULL,
    @Estado     VARCHAR(20) = 'pendiente'
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Pagos (PedidoId, Metodo, Monto, Referencia, Estado)
    VALUES (@PedidoId, @Metodo, @Monto, @Referencia, @Estado);
    SELECT * FROM dbo.Pagos WHERE PagoId = SCOPE_IDENTITY();
END
GO

PRINT 'Stored procedures creados correctamente.';
GO
