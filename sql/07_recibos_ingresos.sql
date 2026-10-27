-- ============================================================================
-- Módulo Recibo de Ingresos (talonario) + Asiento Contable
-- Ejecutar sobre la misma base de datos del sistema.
-- ============================================================================

IF OBJECT_ID('dbo.RecibosIngresos', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.RecibosIngresos (
        ReciboId      INT IDENTITY(1,1) PRIMARY KEY,
        Numero        VARCHAR(20)    NOT NULL UNIQUE,   -- RI-000001
        Fecha         DATETIME       NOT NULL,
        CodCliente    VARCHAR(30)    NOT NULL,
        NombreCliente NVARCHAR(150)  NULL,
        Concepto      NVARCHAR(300)  NULL,
        MontoTotal    DECIMAL(14,2)  NOT NULL,          -- total recibido
        MontoAplicado DECIMAL(14,2)  NOT NULL DEFAULT 0,-- aplicado a facturas
        SaldoFavor    DECIMAL(14,2)  NOT NULL DEFAULT 0,-- anticipo
        MontoLetras   NVARCHAR(300)  NULL,
        Estado        VARCHAR(20)    NOT NULL DEFAULT 'emitido', -- emitido|anulado
        Usuario       NVARCHAR(60)   NULL,
        Creado        DATETIME       NOT NULL DEFAULT GETDATE()
    );
END
GO

IF OBJECT_ID('dbo.ReciboFormasPago', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ReciboFormasPago (
        Id         INT IDENTITY(1,1) PRIMARY KEY,
        ReciboId   INT           NOT NULL REFERENCES dbo.RecibosIngresos(ReciboId),
        Tipo       VARCHAR(20)   NOT NULL,  -- efectivo|cheque|transferencia|tarjeta|otro
        Monto      DECIMAL(14,2) NOT NULL,
        Referencia NVARCHAR(60)  NULL,      -- no. cheque / no. transferencia
        Banco      NVARCHAR(60)  NULL
    );
END
GO

IF OBJECT_ID('dbo.ReciboAplicaciones', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ReciboAplicaciones (
        Id            INT IDENTITY(1,1) PRIMARY KEY,
        ReciboId      INT           NOT NULL REFERENCES dbo.RecibosIngresos(ReciboId),
        NroFact       VARCHAR(30)   NOT NULL,
        MontoAplicado DECIMAL(14,2) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.AsientosContables', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AsientosContables (
        AsientoId   INT IDENTITY(1,1) PRIMARY KEY,
        ReciboId    INT           NOT NULL REFERENCES dbo.RecibosIngresos(ReciboId),
        Fecha       DATETIME      NOT NULL,
        Descripcion NVARCHAR(200) NULL
    );
END
GO

IF OBJECT_ID('dbo.AsientoDetalle', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AsientoDetalle (
        Id          INT IDENTITY(1,1) PRIMARY KEY,
        AsientoId   INT           NOT NULL REFERENCES dbo.AsientosContables(AsientoId),
        Cuenta      VARCHAR(30)   NOT NULL,
        Descripcion NVARCHAR(120) NULL,
        Debito      DECIMAL(14,2) NOT NULL DEFAULT 0,
        Credito     DECIMAL(14,2) NOT NULL DEFAULT 0
    );
END
GO
