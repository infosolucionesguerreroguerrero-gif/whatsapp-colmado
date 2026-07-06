-- =============================================================================
-- Tablas OPCIONALES (aditivas, NO modifican ninguna tabla existente).
-- Soportan las reglas de negocio:
--   #4: registrar todo cambio de estado en historial  -> dbo.EcfHistorial
--   #5: registrar request/response de cada comunicación con DGII -> dbo.LogsDgii
-- Si no se desea crearlas, ajustar EncfEmitidoRepository, DocumentoRepository
-- y DgiiLogRepository para omitir los INSERT correspondientes.
-- =============================================================================

IF OBJECT_ID('dbo.EcfHistorial', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.EcfHistorial (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        EcfId BIGINT NOT NULL,              -- referencia lógica a dbo.ECF.ID
        EstadoAnterior VARCHAR(50) NOT NULL,
        EstadoNuevo VARCHAR(50) NOT NULL,
        Comentario VARCHAR(2000) NULL,
        Usuario VARCHAR(100) NULL,
        Fecha DATETIME2(3) NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_EcfHistorial_EcfId ON dbo.EcfHistorial (EcfId);
END
GO

IF OBJECT_ID('dbo.LogsDgii', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.LogsDgii (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        EcfId BIGINT NULL,                  -- referencia lógica a dbo.ECF.ID (opcional)
        Operacion VARCHAR(50) NOT NULL,
        RequestBody VARCHAR(MAX) NULL,
        ResponseBody VARCHAR(MAX) NULL,
        Exitosa BIT NOT NULL,
        Ambiente VARCHAR(25) NULL,
        Fecha DATETIME2(3) NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_LogsDgii_EcfId ON dbo.LogsDgii (EcfId);
END
GO
