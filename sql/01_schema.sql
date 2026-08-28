/* =====================================================================
   WHATSAPP COLMADO - Esquema de base de datos (SQL Server)
   Archivo 01: Base de datos, tablas, PRIMARY KEY y FOREIGN KEY
   ---------------------------------------------------------------------
   Ejecutar en orden: 01_schema -> 02_indexes -> 03_views ->
                      04_stored_procedures -> 05_triggers -> 06_seed
   ===================================================================== */

IF DB_ID('ColmadoDB') IS NULL
BEGIN
    CREATE DATABASE ColmadoDB;
END
GO

USE ColmadoDB;
GO

/* ---------------------------------------------------------------------
   CONFIGURACION (parámetros del negocio: nombre, envío, ITBIS, etc.)
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Configuracion', 'U') IS NULL
CREATE TABLE dbo.Configuracion (
    ConfigId      INT IDENTITY(1,1) NOT NULL,
    Clave         VARCHAR(100)      NOT NULL,
    Valor         NVARCHAR(500)     NULL,
    Descripcion   NVARCHAR(300)     NULL,
    Actualizado   DATETIME2(0)      NOT NULL CONSTRAINT DF_Configuracion_Act DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Configuracion PRIMARY KEY (ConfigId),
    CONSTRAINT UQ_Configuracion_Clave UNIQUE (Clave)
);
GO

/* ---------------------------------------------------------------------
   CATEGORIAS
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Categorias', 'U') IS NULL
CREATE TABLE dbo.Categorias (
    CategoriaId   INT IDENTITY(1,1) NOT NULL,
    Nombre        NVARCHAR(80)      NOT NULL,
    Descripcion   NVARCHAR(250)     NULL,
    Activo        BIT               NOT NULL CONSTRAINT DF_Categorias_Activo DEFAULT 1,
    Orden         INT               NOT NULL CONSTRAINT DF_Categorias_Orden DEFAULT 0,
    CONSTRAINT PK_Categorias PRIMARY KEY (CategoriaId),
    CONSTRAINT UQ_Categorias_Nombre UNIQUE (Nombre)
);
GO

/* ---------------------------------------------------------------------
   PRODUCTOS
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Productos', 'U') IS NULL
CREATE TABLE dbo.Productos (
    ProductoId    INT IDENTITY(1,1) NOT NULL,
    CategoriaId   INT               NOT NULL,
    Sku           VARCHAR(40)       NULL,
    Nombre        NVARCHAR(150)     NOT NULL,
    Marca         NVARCHAR(80)      NULL,
    Presentacion  NVARCHAR(80)      NULL,   -- "2L", "10 lb", "lata", "funda"
    Unidad        NVARCHAR(30)      NULL,   -- "litro", "libra", "unidad"
    Tamano        NVARCHAR(40)      NULL,   -- "grande", "mediano"
    Precio        DECIMAL(12,2)     NOT NULL CONSTRAINT DF_Productos_Precio DEFAULT 0,
    ImagenUrl     NVARCHAR(400)     NULL,
    Palabras      NVARCHAR(400)     NULL,   -- sinónimos/keywords separados por coma para NLU
    Activo        BIT               NOT NULL CONSTRAINT DF_Productos_Activo DEFAULT 1,
    Creado        DATETIME2(0)      NOT NULL CONSTRAINT DF_Productos_Creado DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Productos PRIMARY KEY (ProductoId),
    CONSTRAINT FK_Productos_Categorias FOREIGN KEY (CategoriaId)
        REFERENCES dbo.Categorias (CategoriaId)
);
GO

/* ---------------------------------------------------------------------
   INVENTARIO (stock por producto)
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Inventario', 'U') IS NULL
CREATE TABLE dbo.Inventario (
    InventarioId  INT IDENTITY(1,1) NOT NULL,
    ProductoId    INT               NOT NULL,
    Existencia    DECIMAL(12,2)     NOT NULL CONSTRAINT DF_Inventario_Exist DEFAULT 0,
    StockMinimo   DECIMAL(12,2)     NOT NULL CONSTRAINT DF_Inventario_Min DEFAULT 0,
    Actualizado   DATETIME2(0)      NOT NULL CONSTRAINT DF_Inventario_Act DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Inventario PRIMARY KEY (InventarioId),
    CONSTRAINT UQ_Inventario_Producto UNIQUE (ProductoId),
    CONSTRAINT FK_Inventario_Productos FOREIGN KEY (ProductoId)
        REFERENCES dbo.Productos (ProductoId)
);
GO

/* ---------------------------------------------------------------------
   OFERTAS
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Ofertas', 'U') IS NULL
CREATE TABLE dbo.Ofertas (
    OfertaId      INT IDENTITY(1,1) NOT NULL,
    ProductoId    INT               NOT NULL,
    Descripcion   NVARCHAR(200)     NULL,
    PrecioOferta  DECIMAL(12,2)     NOT NULL,
    FechaInicio   DATE              NOT NULL,
    FechaFin      DATE              NOT NULL,
    Activo        BIT               NOT NULL CONSTRAINT DF_Ofertas_Activo DEFAULT 1,
    CONSTRAINT PK_Ofertas PRIMARY KEY (OfertaId),
    CONSTRAINT FK_Ofertas_Productos FOREIGN KEY (ProductoId)
        REFERENCES dbo.Productos (ProductoId)
);
GO

/* ---------------------------------------------------------------------
   CLIENTES
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Clientes', 'U') IS NULL
CREATE TABLE dbo.Clientes (
    ClienteId     INT IDENTITY(1,1) NOT NULL,
    Telefono      VARCHAR(30)       NOT NULL,   -- número de WhatsApp (JID normalizado)
    Nombre        NVARCHAR(150)     NULL,
    Activo        BIT               NOT NULL CONSTRAINT DF_Clientes_Activo DEFAULT 1,
    Creado        DATETIME2(0)      NOT NULL CONSTRAINT DF_Clientes_Creado DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Clientes PRIMARY KEY (ClienteId),
    CONSTRAINT UQ_Clientes_Telefono UNIQUE (Telefono)
);
GO

/* ---------------------------------------------------------------------
   DIRECCIONES (una principal + secundarias por cliente)
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Direcciones', 'U') IS NULL
CREATE TABLE dbo.Direcciones (
    DireccionId   INT IDENTITY(1,1) NOT NULL,
    ClienteId     INT               NOT NULL,
    Direccion     NVARCHAR(300)     NOT NULL,
    Referencia    NVARCHAR(200)     NULL,
    Sector        NVARCHAR(120)     NULL,
    EsPrincipal   BIT               NOT NULL CONSTRAINT DF_Direcciones_Princ DEFAULT 0,
    Activo        BIT               NOT NULL CONSTRAINT DF_Direcciones_Activo DEFAULT 1,
    CONSTRAINT PK_Direcciones PRIMARY KEY (DireccionId),
    CONSTRAINT FK_Direcciones_Clientes FOREIGN KEY (ClienteId)
        REFERENCES dbo.Clientes (ClienteId)
);
GO

/* ---------------------------------------------------------------------
   ESTADOS_PEDIDOS (catálogo de estados)
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.EstadosPedidos', 'U') IS NULL
CREATE TABLE dbo.EstadosPedidos (
    EstadoId      INT               NOT NULL,
    Nombre        NVARCHAR(40)      NOT NULL,
    Orden         INT               NOT NULL CONSTRAINT DF_Estados_Orden DEFAULT 0,
    CONSTRAINT PK_EstadosPedidos PRIMARY KEY (EstadoId),
    CONSTRAINT UQ_EstadosPedidos_Nombre UNIQUE (Nombre)
);
GO

/* ---------------------------------------------------------------------
   IMPRESORAS
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Impresoras', 'U') IS NULL
CREATE TABLE dbo.Impresoras (
    ImpresoraId   INT IDENTITY(1,1) NOT NULL,
    Nombre        NVARCHAR(80)      NOT NULL,
    Driver        VARCHAR(20)       NOT NULL CONSTRAINT DF_Impresoras_Driver DEFAULT 'network', -- network|file|noop
    Host          VARCHAR(60)       NULL,
    Puerto        INT               NULL,
    Ancho         INT               NOT NULL CONSTRAINT DF_Impresoras_Ancho DEFAULT 42,
    Activo        BIT               NOT NULL CONSTRAINT DF_Impresoras_Activo DEFAULT 1,
    CONSTRAINT PK_Impresoras PRIMARY KEY (ImpresoraId)
);
GO

/* ---------------------------------------------------------------------
   PEDIDOS
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Pedidos', 'U') IS NULL
CREATE TABLE dbo.Pedidos (
    PedidoId      INT IDENTITY(1000,1) NOT NULL,
    ClienteId     INT               NOT NULL,
    DireccionId   INT               NULL,
    EstadoId      INT               NOT NULL CONSTRAINT DF_Pedidos_Estado DEFAULT 1,
    Subtotal      DECIMAL(12,2)     NOT NULL CONSTRAINT DF_Pedidos_Subtotal DEFAULT 0,
    Envio         DECIMAL(12,2)     NOT NULL CONSTRAINT DF_Pedidos_Envio DEFAULT 0,
    Itbis         DECIMAL(12,2)     NOT NULL CONSTRAINT DF_Pedidos_Itbis DEFAULT 0,
    Total         DECIMAL(12,2)     NOT NULL CONSTRAINT DF_Pedidos_Total DEFAULT 0,
    FormaPago     VARCHAR(30)       NULL,   -- efectivo|transferencia|tarjeta|contraentrega
    Notas         NVARCHAR(400)     NULL,
    TiempoEstimadoMin INT           NULL,
    Creado        DATETIME2(0)      NOT NULL CONSTRAINT DF_Pedidos_Creado DEFAULT SYSUTCDATETIME(),
    Actualizado   DATETIME2(0)      NOT NULL CONSTRAINT DF_Pedidos_Act DEFAULT SYSUTCDATETIME(),
    RowVersion    ROWVERSION,             -- control de concurrencia optimista
    CONSTRAINT PK_Pedidos PRIMARY KEY (PedidoId),
    CONSTRAINT FK_Pedidos_Clientes FOREIGN KEY (ClienteId)
        REFERENCES dbo.Clientes (ClienteId),
    CONSTRAINT FK_Pedidos_Direcciones FOREIGN KEY (DireccionId)
        REFERENCES dbo.Direcciones (DireccionId),
    CONSTRAINT FK_Pedidos_Estados FOREIGN KEY (EstadoId)
        REFERENCES dbo.EstadosPedidos (EstadoId)
);
GO

/* ---------------------------------------------------------------------
   PEDIDOS_DETALLE
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.PedidosDetalle', 'U') IS NULL
CREATE TABLE dbo.PedidosDetalle (
    DetalleId     INT IDENTITY(1,1) NOT NULL,
    PedidoId      INT               NOT NULL,
    ProductoId    INT               NOT NULL,
    Descripcion   NVARCHAR(200)     NOT NULL,  -- snapshot del nombre al momento de la venta
    Cantidad      DECIMAL(12,2)     NOT NULL,
    PrecioUnit    DECIMAL(12,2)     NOT NULL,
    Importe       AS (CAST(Cantidad * PrecioUnit AS DECIMAL(12,2))) PERSISTED,
    CONSTRAINT PK_PedidosDetalle PRIMARY KEY (DetalleId),
    CONSTRAINT FK_Detalle_Pedidos FOREIGN KEY (PedidoId)
        REFERENCES dbo.Pedidos (PedidoId) ON DELETE CASCADE,
    CONSTRAINT FK_Detalle_Productos FOREIGN KEY (ProductoId)
        REFERENCES dbo.Productos (ProductoId)
);
GO

/* ---------------------------------------------------------------------
   FORMAS DE PAGO (catálogo dinámico)
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.FormasPago', 'U') IS NULL
CREATE TABLE dbo.FormasPago (
    FormaPagoId      INT IDENTITY(1,1) NOT NULL,
    Codigo           VARCHAR(10)      NOT NULL,            -- clave corta: 1, C, L, 6, 8
    Nombre           NVARCHAR(60)     NOT NULL,
    Orden            INT              NOT NULL CONSTRAINT DF_FormasPago_Orden DEFAULT 0,
    RequiereReferencia BIT            NOT NULL CONSTRAINT DF_FormasPago_Ref DEFAULT 0,
    EsPagoMultiple   BIT            NOT NULL CONSTRAINT DF_FormasPago_Mult DEFAULT 0,
    Activo           BIT            NOT NULL CONSTRAINT DF_FormasPago_Activo DEFAULT 1,
    Creado           DATETIME2(0)     NOT NULL CONSTRAINT DF_FormasPago_Creado DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_FormasPago PRIMARY KEY (FormaPagoId),
    CONSTRAINT UQ_FormasPago_Codigo UNIQUE (Codigo)
);
GO

/* ---------------------------------------------------------------------
   MONEDAS (divisas con tasa y prima)
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Monedas', 'U') IS NULL
CREATE TABLE dbo.Monedas (
    MonedaId      INT IDENTITY(1,1) NOT NULL,
    Codigo        VARCHAR(5)        NOT NULL,            -- USD, EUR, CAD
    Nombre        NVARCHAR(40)      NOT NULL,
    Simbolo       NVARCHAR(5)       NULL,
    Tasa          DECIMAL(12,4)     NOT NULL CONSTRAINT DF_Monedas_Tasa DEFAULT 0,
    Prima         DECIMAL(5,2)      NOT NULL CONSTRAINT DF_Monedas_Prima DEFAULT 0,
    Orden         INT               NOT NULL CONSTRAINT DF_Monedas_Orden DEFAULT 0,
    Activo        BIT               NOT NULL CONSTRAINT DF_Monedas_Activo DEFAULT 1,
    Actualizado   DATETIME2(0)      NOT NULL CONSTRAINT DF_Monedas_Act DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Monedas PRIMARY KEY (MonedaId),
    CONSTRAINT UQ_Monedas_Codigo UNIQUE (Codigo)
);
GO

/* ---------------------------------------------------------------------
   PAGOS
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Pagos', 'U') IS NULL
CREATE TABLE dbo.Pagos (
    PagoId        INT IDENTITY(1,1) NOT NULL,
    PedidoId      INT               NOT NULL,
    Metodo        VARCHAR(30)       NOT NULL,  -- nombre de la forma de pago
    Monto         DECIMAL(12,2)     NOT NULL,  -- monto en moneda base
    Referencia    NVARCHAR(120)     NULL,
    Estado        VARCHAR(20)       NOT NULL CONSTRAINT DF_Pagos_Estado DEFAULT 'pendiente', -- pendiente|pagado|fallido
    Moneda        VARCHAR(10)       NULL,      -- código de moneda si aplica
    MontoMoneda   DECIMAL(12,2)     NULL,      -- monto original en moneda extranjera
    Tasa          DECIMAL(12,4)     NULL,      -- tasa aplicada
    Prima         DECIMAL(5,2)      NULL,      -- prima % aplicada
    Creado        DATETIME2(0)      NOT NULL CONSTRAINT DF_Pagos_Creado DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Pagos PRIMARY KEY (PagoId),
    CONSTRAINT FK_Pagos_Pedidos FOREIGN KEY (PedidoId)
        REFERENCES dbo.Pedidos (PedidoId) ON DELETE CASCADE
);
GO

-- Asegura columnas de moneda en despliegues existentes
IF COL_LENGTH('dbo.Pagos', 'Moneda') IS NULL
    ALTER TABLE dbo.Pagos ADD Moneda VARCHAR(10) NULL;
IF COL_LENGTH('dbo.Pagos', 'MontoMoneda') IS NULL
    ALTER TABLE dbo.Pagos ADD MontoMoneda DECIMAL(12,2) NULL;
IF COL_LENGTH('dbo.Pagos', 'Tasa') IS NULL
    ALTER TABLE dbo.Pagos ADD Tasa DECIMAL(12,4) NULL;
IF COL_LENGTH('dbo.Pagos', 'Prima') IS NULL
    ALTER TABLE dbo.Pagos ADD Prima DECIMAL(5,2) NULL;
GO

/* ---------------------------------------------------------------------
   PEDIDO FACTURACIÓN ELECTRÓNICA (timbre / NCF)
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.PedidoFacturacionElectronica', 'U') IS NULL
CREATE TABLE dbo.PedidoFacturacionElectronica (
    PedidoFacturacionId INT IDENTITY(1,1) NOT NULL,
    PedidoId            INT               NOT NULL,
    Ncf                 VARCHAR(20)       NULL,
    TrackId             VARCHAR(40)       NULL,
    Estado              VARCHAR(20)       NOT NULL CONSTRAINT DF_PedidoFe_Estado DEFAULT 'pendiente', -- pendiente|enviado|aceptado|rechazado
    CodigoSeguridad     VARCHAR(10)       NULL,
    UrlQr               NVARCHAR(500)     NULL,
    RespuestaJson       NVARCHAR(MAX)     NULL,
    Creado              DATETIME2(0)      NOT NULL CONSTRAINT DF_PedidoFe_Creado DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_PedidoFacturacionElectronica PRIMARY KEY (PedidoFacturacionId),
    CONSTRAINT UQ_PedidoFacturacionElectronica_Pedido UNIQUE (PedidoId),
    CONSTRAINT FK_PedidoFacturacionElectronica_Pedidos FOREIGN KEY (PedidoId)
        REFERENCES dbo.Pedidos (PedidoId) ON DELETE CASCADE
);
GO

/* ---------------------------------------------------------------------
   HISTORIAL DE ESTADOS (trazabilidad de cambios de estado del pedido)
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.PedidoEstadoHistorial', 'U') IS NULL
CREATE TABLE dbo.PedidoEstadoHistorial (
    HistorialId   INT IDENTITY(1,1) NOT NULL,
    PedidoId      INT               NOT NULL,
    EstadoId      INT               NOT NULL,
    Creado        DATETIME2(0)      NOT NULL CONSTRAINT DF_PEH_Creado DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_PedidoEstadoHistorial PRIMARY KEY (HistorialId),
    CONSTRAINT FK_PEH_Pedidos FOREIGN KEY (PedidoId)
        REFERENCES dbo.Pedidos (PedidoId) ON DELETE CASCADE,
    CONSTRAINT FK_PEH_Estados FOREIGN KEY (EstadoId)
        REFERENCES dbo.EstadosPedidos (EstadoId)
);
GO

/* ---------------------------------------------------------------------
   LOGS (auditoría de eventos del sistema)
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.Logs', 'U') IS NULL
CREATE TABLE dbo.Logs (
    LogId         BIGINT IDENTITY(1,1) NOT NULL,
    Nivel         VARCHAR(10)       NOT NULL,  -- info|warn|error
    Origen        VARCHAR(60)       NULL,      -- whatsapp|api|printer|nlu|db
    Mensaje       NVARCHAR(1000)    NOT NULL,
    Datos         NVARCHAR(MAX)     NULL,      -- JSON adicional
    Telefono      VARCHAR(30)       NULL,
    Creado        DATETIME2(0)      NOT NULL CONSTRAINT DF_Logs_Creado DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Logs PRIMARY KEY (LogId)
);
GO

PRINT 'Esquema base creado correctamente.';
GO
