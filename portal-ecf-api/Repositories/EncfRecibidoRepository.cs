using Dapper;
using PortalEcf.Api.Common;
using PortalEcf.Api.Data;
using PortalEcf.Api.Dtos;

namespace PortalEcf.Api.Repositories;

// Adaptado al esquema real: dbo.DocumentosXML almacena los documentos recibidos
// (RncReceptor = RNC de la empresa). Los montos se extraen del propio XML.
public class EncfRecibidoRepository : IEncfRecibidoRepository
{
    private const string SelectRecibido = @"
SELECT
    d.Id,
    d.NCF                     AS Encf,
    d.TipoDocumento,
    d.RncEmisor,
    d.XmlDocumento.value('(//*[local-name()=""RazonSocialEmisor""])[1]', 'nvarchar(255)') AS RazonSocialEmisor,
    d.RncReceptor             AS RncComprador,
    ISNULL(TRY_CONVERT(DATETIME, d.XmlDocumento.value('(//*[local-name()=""FechaEmision""])[1]', 'nvarchar(25)'), 105),
           d.FechaCreacion)   AS FechaEmision,
    ISNULL(d.XmlDocumento.value('(//*[local-name()=""MontoTotal""])[1]', 'decimal(18,2)'), 0) AS MontoTotal,
    ISNULL(d.XmlDocumento.value('(//*[local-name()=""TotalITBIS""])[1]', 'decimal(18,2)'), 0) AS TotalItbis,
    d.Estado,
    d.FechaCreacion           AS FechaRecepcion
FROM dbo.DocumentosXML d";

    private readonly IDbConnectionFactory _connectionFactory;

    public EncfRecibidoRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<PagedResponse<EncfRecibidoResponse>> GetListAsync(EncfListFilter filter)
    {
        const string where = @"
WHERE d.TipoDocumento = 'Recibido'
  AND (@FechaDesde IS NULL OR d.FechaCreacion >= @FechaDesde)
  AND (@FechaHasta IS NULL OR d.FechaCreacion < DATEADD(DAY, 1, @FechaHasta))
  AND (@Estado IS NULL OR d.Estado = @Estado)
  AND (@Encf IS NULL OR d.NCF = @Encf)
  AND (@Rnc IS NULL OR d.RncEmisor = @Rnc)";

        var sql = $@"
SELECT COUNT(1) FROM dbo.DocumentosXML d {where};

{SelectRecibido}
{where}
ORDER BY d.FechaCreacion DESC, d.Id DESC
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
            Offset = (page - 1) * pageSize,
            PageSize = pageSize
        });

        var totalCount = await multi.ReadSingleAsync<int>();
        var items = (await multi.ReadAsync<EncfRecibidoResponse>()).ToList();
        return new PagedResponse<EncfRecibidoResponse>(items, page, pageSize, totalCount);
    }

    public async Task<EncfRecibidoResponse?> GetByIdAsync(long id)
    {
        var sql = $"{SelectRecibido}\nWHERE d.Id = @Id AND d.TipoDocumento = 'Recibido';";

        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<EncfRecibidoResponse>(sql, new { Id = id });
    }

    public async Task<bool> ExisteEncfAsync(string encf, string rncEmisor)
    {
        const string sql = @"
SELECT CASE WHEN EXISTS (
    SELECT 1 FROM dbo.DocumentosXML
    WHERE NCF = @Encf AND RncEmisor = @RncEmisor AND TipoDocumento = 'Recibido'
) THEN 1 ELSE 0 END;";

        using var connection = _connectionFactory.CreateConnection();
        return await connection.ExecuteScalarAsync<bool>(sql, new { Encf = encf, RncEmisor = rncEmisor });
    }

    public async Task<long> RecibirXmlAsync(RecibirXmlRequest request, string encf, string rncEmisor, string rncComprador,
        string tipoDocumento, DateTime fechaEmision, decimal montoTotal, decimal totalItbis, string usuario)
    {
        const string insertXml = @"
INSERT INTO dbo.DocumentosXML
    (TipoDocumento, RncEmisor, RncReceptor, NCF, XmlDocumento, Estado, Ambiente, FechaCreacion, UsuarioCreacion, Observaciones)
OUTPUT INSERTED.Id
VALUES
    ('Recibido', @RncEmisor, @RncReceptor, @Encf, CAST(@Xml AS XML), 'Pendiente',
     ISNULL((SELECT TOP 1 valor FROM dbo.config WHERE clave = 'Ambiente'), 'TestECF'),
     SYSDATETIME(), @Usuario, @Origen);";

        using var connection = _connectionFactory.CreateConnection();
        return await connection.ExecuteScalarAsync<long>(insertXml, new
        {
            RncEmisor = rncEmisor,
            RncReceptor = rncComprador,
            Encf = encf,
            Xml = request.XmlContenido,
            Usuario = usuario,
            request.Origen
        });
    }

    public async Task<string?> GetXmlAsync(long id)
    {
        const string sql = @"
SELECT CAST(d.XmlDocumento AS NVARCHAR(MAX))
FROM dbo.DocumentosXML d
WHERE d.Id = @Id;";

        using var connection = _connectionFactory.CreateConnection();
        return await connection.ExecuteScalarAsync<string?>(sql, new { Id = id });
    }

    public async Task ActualizarEstadoAsync(long id, string estado, string? comentario, string usuario)
    {
        const string sql = @"
UPDATE dbo.DocumentosXML
SET Estado = @Estado,
    FechaRespuesta = SYSDATETIME(),
    Observaciones = CONCAT(ISNULL(Observaciones, ''), CHAR(13), CHAR(10),
        CONVERT(VARCHAR(20), SYSDATETIME(), 120), ' [', @Usuario, '] ', ISNULL(@Comentario, ''))
WHERE Id = @Id;";

        using var connection = _connectionFactory.CreateConnection();
        await connection.ExecuteAsync(sql, new { Id = id, Estado = estado, Comentario = comentario, Usuario = usuario });
    }
}
