using Dapper;
using PortalEcf.Api.Common;
using PortalEcf.Api.Data;
using PortalEcf.Api.Dtos;

namespace PortalEcf.Api.Repositories;

// Adaptado al esquema real: dbo.ECF (emitidos) y dbo.DocumentosXML (recibidos/XML).
// El tipo de comprobante se deriva del eNCF: SUBSTRING(eNCF, 2, 2) -> '31', '32', '34', etc.
public class DashboardRepository : IDashboardRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public DashboardRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<DashboardResumenResponse> GetResumenAsync(DashboardResumenFilter filter)
    {
        const string sql = @"
DECLARE @InicioMes DATE = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);
DECLARE @Hoy DATE = CAST(GETDATE() AS DATE);

SELECT
    TotalFacturas       = COUNT(CASE WHEN SUBSTRING(e.eNCF, 2, 2) IN ('31','32') THEN 1 END),
    TotalDevoluciones   = COUNT(CASE WHEN SUBSTRING(e.eNCF, 2, 2) = '34' THEN 1 END),
    TotalGastos         = COUNT(CASE WHEN SUBSTRING(e.eNCF, 2, 2) IN ('41','47') THEN 1 END),
    TotalMes            = ISNULL(SUM(CASE WHEN e.FechaEmisionDate >= @InicioMes THEN e.MontoTotal END), 0),
    FacturasDelDia      = COUNT(CASE WHEN CAST(e.FechaEmisionDate AS DATE) = @Hoy AND SUBSTRING(e.eNCF, 2, 2) IN ('31','32') THEN 1 END),
    VentasDelMes        = ISNULL(SUM(CASE WHEN e.FechaEmisionDate >= @InicioMes AND SUBSTRING(e.eNCF, 2, 2) IN ('31','32') THEN e.MontoTotal END), 0),
    DevolucionesDelMes  = ISNULL(SUM(CASE WHEN e.FechaEmisionDate >= @InicioMes AND SUBSTRING(e.eNCF, 2, 2) = '34' THEN e.MontoTotal END), 0),
    GastosDelMes        = ISNULL(SUM(CASE WHEN e.FechaEmisionDate >= @InicioMes AND SUBSTRING(e.eNCF, 2, 2) IN ('41','47') THEN e.MontoTotal END), 0),
    Aceptados           = COUNT(CASE WHEN e.Estado IN ('Aceptado','Aceptado Condicional') THEN 1 END),
    Rechazados          = COUNT(CASE WHEN e.Estado = 'Rechazado' THEN 1 END),
    EnProceso           = COUNT(CASE WHEN e.Estado = 'En Proceso' OR e.Estado = 'EnProceso' THEN 1 END),
    Pendientes          = COUNT(CASE WHEN e.Estado = 'Pendiente' THEN 1 END)
FROM dbo.ECF e
WHERE (@FechaDesde IS NULL OR e.FechaEmisionDate >= @FechaDesde)
  AND (@FechaHasta IS NULL OR e.FechaEmisionDate < DATEADD(DAY, 1, @FechaHasta))
  AND (@RncEmpresa IS NULL OR e.RncEmisor = @RncEmpresa)
  AND (@Ambiente IS NULL OR e.Ambiente = @Ambiente);";

        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleAsync<DashboardResumenResponse>(sql, new
        {
            filter.FechaDesde,
            filter.FechaHasta,
            filter.RncEmpresa,
            filter.Ambiente
        });
    }

    public async Task<PagedResponse<ActividadRecienteItemResponse>> GetActividadRecienteAsync(ActividadRecienteFilter filter)
    {
        const string sql = @"
SELECT COUNT(1)
FROM dbo.ECF e
WHERE (@FechaDesde IS NULL OR e.FechaEmisionDate >= @FechaDesde)
  AND (@FechaHasta IS NULL OR e.FechaEmisionDate < DATEADD(DAY, 1, @FechaHasta))
  AND (@Estado IS NULL OR e.Estado = @Estado)
  AND (@RncComprador IS NULL OR e.RncComprador = @RncComprador)
  AND (@Ncf IS NULL OR e.eNCF = @Ncf)
  AND (@TipoDocumento IS NULL OR SUBSTRING(e.eNCF, 2, 2) = @TipoDocumento);

SELECT
    e.ID                AS Id,
    e.eNCF              AS Ncf,
    e.RncComprador,
    e.FechaEmisionDate  AS Fecha,
    e.MontoTotal        AS Monto,
    e.Estado
FROM dbo.ECF e
WHERE (@FechaDesde IS NULL OR e.FechaEmisionDate >= @FechaDesde)
  AND (@FechaHasta IS NULL OR e.FechaEmisionDate < DATEADD(DAY, 1, @FechaHasta))
  AND (@Estado IS NULL OR e.Estado = @Estado)
  AND (@RncComprador IS NULL OR e.RncComprador = @RncComprador)
  AND (@Ncf IS NULL OR e.eNCF = @Ncf)
  AND (@TipoDocumento IS NULL OR SUBSTRING(e.eNCF, 2, 2) = @TipoDocumento)
ORDER BY e.FechaEmisionDate DESC, e.ID DESC
OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;";

        var page = Math.Max(filter.Page, 1);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);

        using var connection = _connectionFactory.CreateConnection();
        using var multi = await connection.QueryMultipleAsync(sql, new
        {
            filter.FechaDesde,
            filter.FechaHasta,
            filter.Estado,
            filter.RncComprador,
            filter.Ncf,
            filter.TipoDocumento,
            Offset = (page - 1) * pageSize,
            PageSize = pageSize
        });

        var totalCount = await multi.ReadSingleAsync<int>();
        var items = (await multi.ReadAsync<ActividadRecienteItemResponse>()).ToList();

        return new PagedResponse<ActividadRecienteItemResponse>(items, page, pageSize, totalCount);
    }

    public async Task<GlobalSearchResponse> GlobalSearchAsync(string term, int maxPorCategoria)
    {
        const string sql = @"
-- Facturas emitidas (dbo.ECF)
SELECT TOP (@Max)
    CAST(e.ID AS BIGINT) AS Id, 'facturaEmitida' AS Tipo, e.eNCF AS Encf, e.RncComprador AS Rnc,
    e.NombreCompraDoR AS RazonSocial, e.FechaEmisionDate AS Fecha,
    e.MontoTotal AS Monto, e.Estado, e.ECFID AS NumeroInterno
FROM dbo.ECF e
WHERE e.eNCF = @Term OR e.RncComprador = @Term OR e.RncEmisor = @Term
   OR e.ECFID = @Term OR e.NombreCompraDoR LIKE @TermLike
ORDER BY e.FechaEmisionDate DESC;

-- Facturas recibidas (dbo.DocumentosXML)
SELECT TOP (@Max)
    d.Id, 'facturaRecibida' AS Tipo, d.NCF AS Encf, d.RncEmisor AS Rnc,
    CAST(NULL AS NVARCHAR(255)) AS RazonSocial, d.FechaCreacion AS Fecha,
    d.XmlDocumento.value('(//*[local-name()=""MontoTotal""])[1]', 'decimal(18,2)') AS Monto,
    d.Estado, d.TrackId AS NumeroInterno
FROM dbo.DocumentosXML d
WHERE d.NCF = @Term OR d.RncEmisor = @Term OR d.RncReceptor = @Term OR d.TrackId = @Term
ORDER BY d.FechaCreacion DESC;

-- Clientes (compradores distintos en dbo.ECF)
SELECT TOP (@Max)
    CAST(MIN(e.ID) AS BIGINT) AS Id, 'cliente' AS Tipo, CAST(NULL AS VARCHAR(19)) AS Encf,
    e.RncComprador AS Rnc, MAX(e.NombreCompraDoR) AS RazonSocial,
    CAST(NULL AS DATETIME) AS Fecha, CAST(NULL AS DECIMAL(18,2)) AS Monto,
    CAST(NULL AS VARCHAR(50)) AS Estado, CAST(NULL AS VARCHAR(25)) AS NumeroInterno
FROM dbo.ECF e
WHERE e.RncComprador = @Term OR e.NombreCompraDoR LIKE @TermLike
GROUP BY e.RncComprador;

-- Proveedores (emisores distintos en dbo.DocumentosXML)
SELECT TOP (@Max)
    MIN(d.Id) AS Id, 'proveedor' AS Tipo, CAST(NULL AS VARCHAR(19)) AS Encf,
    d.RncEmisor AS Rnc, CAST(NULL AS NVARCHAR(255)) AS RazonSocial,
    CAST(NULL AS DATETIME) AS Fecha, CAST(NULL AS DECIMAL(18,2)) AS Monto,
    CAST(NULL AS VARCHAR(50)) AS Estado, CAST(NULL AS VARCHAR(25)) AS NumeroInterno
FROM dbo.DocumentosXML d
WHERE d.RncEmisor = @Term
GROUP BY d.RncEmisor;

-- Documentos firmados (dbo.ECF con FechaHoraFirma)
SELECT TOP (@Max)
    CAST(e.ID AS BIGINT) AS Id, 'documentoFirmado' AS Tipo, e.eNCF AS Encf, e.RncEmisor AS Rnc,
    CAST(NULL AS NVARCHAR(255)) AS RazonSocial, TRY_CONVERT(DATETIME, e.FechaHoraFirma) AS Fecha,
    e.MontoTotal AS Monto, e.Estado, e.ECFID AS NumeroInterno
FROM dbo.ECF e
WHERE e.FechaHoraFirma IS NOT NULL
  AND (e.eNCF = @Term OR e.RncEmisor = @Term);";

        using var connection = _connectionFactory.CreateConnection();
        using var multi = await connection.QueryMultipleAsync(sql, new
        {
            Term = term,
            TermLike = $"%{EscapeLike(term)}%",
            Max = maxPorCategoria
        });

        return new GlobalSearchResponse
        {
            Term = term,
            FacturasEmitidas = (await multi.ReadAsync<SearchResultItemResponse>()).ToList(),
            FacturasRecibidas = (await multi.ReadAsync<SearchResultItemResponse>()).ToList(),
            Clientes = (await multi.ReadAsync<SearchResultItemResponse>()).ToList(),
            Proveedores = (await multi.ReadAsync<SearchResultItemResponse>()).ToList(),
            DocumentosFirmados = (await multi.ReadAsync<SearchResultItemResponse>()).ToList()
        };
    }

    // Escapa los comodines de LIKE de SQL Server ([, % y _) usando clases de caracteres.
    private static string EscapeLike(string value) =>
        value.Replace("[", "[[]").Replace("%", "[%]").Replace("_", "[_]");
}
