using Dapper;
using PortalEcf.Api.Common;
using PortalEcf.Api.Data;
using PortalEcf.Api.Dtos;

namespace PortalEcf.Api.Repositories;

// Adaptado al esquema real: dbo.ECF (cabecera del e-CF emitido) y dbo.DocumentosXML (XML asociado,
// vinculado por NCF + RncEmisor). El historial usa dbo.EcfHistorial (tabla opcional adicional,
// ver sql/tablas_opcionales.sql); si no existe, comentar los INSERT correspondientes.
public class EncfEmitidoRepository : IEncfEmitidoRepository
{
    private const string SelectEcf = @"
SELECT
    CAST(e.ID AS BIGINT)      AS Id,
    e.eNCF                    AS Encf,
    SUBSTRING(e.eNCF, 2, 2)   AS TipoDocumento,
    e.RncEmisor,
    e.RncComprador,
    e.NombreCompraDoR         AS RazonSocialComprador,
    e.FechaEmisionDate        AS FechaEmision,
    ISNULL(e.MontoTotal, 0)   AS MontoTotal,
    ISNULL(e.TotalItbis, 0)   AS TotalItbis,
    e.Estado,
    e.CodigoSeguridad,
    e.TrackId                 AS TrackIdDgii,
    e.Ambiente,
    e.FechaEmisionDate        AS FechaCreacion
FROM dbo.ECF e";

    private readonly IDbConnectionFactory _connectionFactory;

    public EncfEmitidoRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<PagedResponse<EncfEmitidoResponse>> GetListAsync(EncfListFilter filter)
    {
        const string where = @"
WHERE (@FechaDesde IS NULL OR e.FechaEmisionDate >= @FechaDesde)
  AND (@FechaHasta IS NULL OR e.FechaEmisionDate < DATEADD(DAY, 1, @FechaHasta))
  AND (@Estado IS NULL OR e.Estado = @Estado)
  AND (@Encf IS NULL OR e.eNCF = @Encf)
  AND (@Rnc IS NULL OR e.RncComprador = @Rnc)
  AND (@TipoDocumento IS NULL OR SUBSTRING(e.eNCF, 2, 2) = @TipoDocumento)";

        var sql = $@"
SELECT COUNT(1) FROM dbo.ECF e {where};

{SelectEcf}
{where}
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
            filter.Encf,
            filter.Rnc,
            filter.TipoDocumento,
            Offset = (page - 1) * pageSize,
            PageSize = pageSize
        });

        var totalCount = await multi.ReadSingleAsync<int>();
        var items = (await multi.ReadAsync<EncfEmitidoResponse>()).ToList();
        return new PagedResponse<EncfEmitidoResponse>(items, page, pageSize, totalCount);
    }

    public async Task<EncfEmitidoResponse?> GetByIdAsync(long id)
    {
        var sql = $"{SelectEcf}\nWHERE e.ID = @Id;";

        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<EncfEmitidoResponse>(sql, new { Id = id });
    }

    public async Task<bool> ExisteEncfAsync(string encf, string rncEmisor)
    {
        const string sql = @"
SELECT CASE WHEN EXISTS (
    SELECT 1 FROM dbo.ECF WHERE eNCF = @Encf AND RncEmisor = @RncEmisor
) THEN 1 ELSE 0 END;";

        using var connection = _connectionFactory.CreateConnection();
        return await connection.ExecuteScalarAsync<bool>(sql, new { Encf = encf, RncEmisor = rncEmisor });
    }

    public async Task<long> CrearAsync(CrearEncfRequest request, string usuario)
    {
        // dbo.ECF guarda FechaEmision como varchar en formato 105 (dd-mm-yyyy);
        // la columna calculada FechaEmisionDate hace la conversión.
        const string insertEcf = @"
INSERT INTO dbo.ECF
    (eNCF, FechaEmision, RncEmisor, RncComprador, NombreCompraDoR,
     MontoTotal, TotalItbis, Estado, Ambiente)
OUTPUT CAST(INSERTED.ID AS BIGINT)
VALUES
    (@Encf, CONVERT(VARCHAR(10), @FechaEmision, 105), @RncEmisor, @RncComprador, @RazonSocialComprador,
     @MontoTotal, @TotalItbis, 'Pendiente', @Ambiente);";

        const string insertXml = @"
INSERT INTO dbo.DocumentosXML
    (TipoDocumento, RncEmisor, RncReceptor, NCF, XmlDocumento, Estado, Ambiente, FechaCreacion, UsuarioCreacion)
VALUES
    (@TipoDocumento, @RncEmisor, @RncComprador, @Encf, CAST(@Xml AS XML), 'Pendiente', @Ambiente, SYSDATETIME(), @Usuario);";

        const string insertHistorial = @"
INSERT INTO dbo.EcfHistorial (EcfId, EstadoAnterior, EstadoNuevo, Comentario, Usuario, Fecha)
VALUES (@EcfId, '', 'Pendiente', 'Documento creado', @Usuario, SYSDATETIME());";

        using var connection = _connectionFactory.CreateConnection();
        connection.Open();
        using var transaction = connection.BeginTransaction();
        try
        {
            var id = await connection.ExecuteScalarAsync<long>(insertEcf, new
            {
                request.Encf,
                request.FechaEmision,
                request.RncEmisor,
                request.RncComprador,
                request.RazonSocialComprador,
                request.MontoTotal,
                request.TotalItbis,
                request.Ambiente
            }, transaction);

            await connection.ExecuteAsync(insertXml, new
            {
                request.TipoDocumento,
                request.RncEmisor,
                request.RncComprador,
                request.Encf,
                Xml = request.XmlOriginal,
                request.Ambiente,
                Usuario = usuario
            }, transaction);

            await connection.ExecuteAsync(insertHistorial, new { EcfId = id, Usuario = usuario }, transaction);

            transaction.Commit();
            return id;
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    public async Task<string?> GetXmlAsync(long id, bool firmado)
    {
        // El XML (original o firmado) vive en dbo.DocumentosXML, vinculado por NCF + RncEmisor.
        // Si @Firmado = 1 se exige que el ECF tenga FechaHoraFirma registrada.
        const string sql = @"
SELECT TOP 1 CAST(d.XmlDocumento AS NVARCHAR(MAX))
FROM dbo.ECF e
JOIN dbo.DocumentosXML d ON d.NCF = e.eNCF AND d.RncEmisor = e.RncEmisor
WHERE e.ID = @Id
  AND (@Firmado = 0 OR e.FechaHoraFirma IS NOT NULL)
ORDER BY d.FechaCreacion DESC;";

        using var connection = _connectionFactory.CreateConnection();
        return await connection.ExecuteScalarAsync<string?>(sql, new { Id = id, Firmado = firmado });
    }

    public async Task ActualizarEnvioDgiiAsync(long id, string estado, string? trackId, string usuario)
    {
        const string insertHistorial = @"
INSERT INTO dbo.EcfHistorial (EcfId, EstadoAnterior, EstadoNuevo, Comentario, Usuario, Fecha)
SELECT @Id, ISNULL(e.Estado, ''), @Estado, 'Actualización por envío a DGII', @Usuario, SYSDATETIME()
FROM dbo.ECF e WHERE e.ID = @Id;";

        const string updateEcf = @"
UPDATE dbo.ECF
SET Estado = @Estado,
    TrackId = COALESCE(@TrackId, TrackId)
WHERE ID = @Id;";

        const string updateXml = @"
UPDATE d
SET d.Estado = @Estado,
    d.TrackId = COALESCE(@TrackId, d.TrackId),
    d.FechaEnvio = SYSDATETIME()
FROM dbo.DocumentosXML d
JOIN dbo.ECF e ON d.NCF = e.eNCF AND d.RncEmisor = e.RncEmisor
WHERE e.ID = @Id;";

        using var connection = _connectionFactory.CreateConnection();
        connection.Open();
        using var transaction = connection.BeginTransaction();
        try
        {
            await connection.ExecuteAsync(insertHistorial, new { Id = id, Estado = estado, Usuario = usuario }, transaction);
            await connection.ExecuteAsync(updateEcf, new { Id = id, Estado = estado, TrackId = trackId }, transaction);
            await connection.ExecuteAsync(updateXml, new { Id = id, Estado = estado, TrackId = trackId }, transaction);
            transaction.Commit();
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    public async Task GuardarXmlFirmadoAsync(long id, string xmlFirmado)
    {
        const string sql = @"
UPDATE d
SET d.XmlDocumento = CAST(@Xml AS XML)
FROM dbo.DocumentosXML d
JOIN dbo.ECF e ON d.NCF = e.eNCF AND d.RncEmisor = e.RncEmisor
WHERE e.ID = @Id;

UPDATE dbo.ECF
SET FechaHoraFirma = CONVERT(VARCHAR(20), SYSDATETIME(), 120)
WHERE ID = @Id;";

        using var connection = _connectionFactory.CreateConnection();
        await connection.ExecuteAsync(sql, new { Id = id, Xml = xmlFirmado });
    }
}
