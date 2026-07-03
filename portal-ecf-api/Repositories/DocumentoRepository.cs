using Dapper;
using PortalEcf.Api.Common;
using PortalEcf.Api.Data;
using PortalEcf.Api.Dtos;

namespace PortalEcf.Api.Repositories;

// Adaptado al esquema real: los documentos firmados son filas de dbo.ECF con FechaHoraFirma.
// El historial de estados usa dbo.EcfHistorial (tabla opcional adicional, ver sql/tablas_opcionales.sql).
public class DocumentoRepository : IDocumentoRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public DocumentoRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<PagedResponse<DocumentoFirmadoResponse>> GetFirmadosAsync(int page, int pageSize)
    {
        const string sql = @"
SELECT COUNT(1) FROM dbo.ECF e WHERE e.FechaHoraFirma IS NOT NULL;

SELECT
    CAST(e.ID AS BIGINT) AS Id,
    e.eNCF AS Encf,
    e.RncEmisor,
    ISNULL(TRY_CONVERT(DATETIME, e.FechaHoraFirma, 120), TRY_CONVERT(DATETIME, e.FechaHoraFirma)) AS FechaFirma,
    CAST(NULL AS NVARCHAR(100)) AS HuellaCertificado,
    e.Estado
FROM dbo.ECF e
WHERE e.FechaHoraFirma IS NOT NULL
ORDER BY e.ID DESC
OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;";

        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        using var connection = _connectionFactory.CreateConnection();
        using var multi = await connection.QueryMultipleAsync(sql, new
        {
            Offset = (page - 1) * pageSize,
            PageSize = pageSize
        });

        var totalCount = await multi.ReadSingleAsync<int>();
        var items = (await multi.ReadAsync<DocumentoFirmadoResponse>()).ToList();
        return new PagedResponse<DocumentoFirmadoResponse>(items, page, pageSize, totalCount);
    }

    public async Task<DocumentoFirmadoResponse?> GetFirmadoByIdAsync(long id)
    {
        const string sql = @"
SELECT
    CAST(e.ID AS BIGINT) AS Id,
    e.eNCF AS Encf,
    e.RncEmisor,
    ISNULL(TRY_CONVERT(DATETIME, e.FechaHoraFirma, 120), TRY_CONVERT(DATETIME, e.FechaHoraFirma)) AS FechaFirma,
    CAST(NULL AS NVARCHAR(100)) AS HuellaCertificado,
    e.Estado
FROM dbo.ECF e
WHERE e.ID = @Id AND e.FechaHoraFirma IS NOT NULL;";

        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<DocumentoFirmadoResponse>(sql, new { Id = id });
    }

    public async Task<long> RegistrarFirmaAsync(long? documentoId, string? encf, string? rncEmisor, string xmlFirmado, string huella, string usuario)
    {
        const string updateEcf = @"
UPDATE dbo.ECF
SET FechaHoraFirma = CONVERT(VARCHAR(20), SYSDATETIME(), 120)
WHERE ID = @Id;";

        const string insertXml = @"
INSERT INTO dbo.DocumentosXML
    (TipoDocumento, RncEmisor, NCF, XmlDocumento, Estado, Ambiente, FechaCreacion, UsuarioCreacion, Observaciones)
OUTPUT INSERTED.Id
VALUES
    ('Firmado', @RncEmisor, @Encf, CAST(@Xml AS XML), 'Firmado',
     ISNULL((SELECT TOP 1 valor FROM dbo.config WHERE clave = 'Ambiente'), 'TestECF'),
     SYSDATETIME(), @Usuario, @Huella);";

        using var connection = _connectionFactory.CreateConnection();
        connection.Open();
        using var transaction = connection.BeginTransaction();
        try
        {
            if (documentoId.HasValue)
            {
                await connection.ExecuteAsync(updateEcf, new { Id = documentoId.Value }, transaction);
            }

            var firmaId = await connection.ExecuteScalarAsync<long>(insertXml, new
            {
                RncEmisor = rncEmisor,
                Encf = encf,
                Xml = xmlFirmado,
                Usuario = usuario,
                Huella = $"Huella: {huella}"
            }, transaction);

            transaction.Commit();
            return documentoId ?? firmaId;
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    public async Task<IReadOnlyList<DocumentoHistorialResponse>> GetHistorialAsync(long documentoId)
    {
        const string sql = @"
SELECT h.Id, h.EcfId AS DocumentoId, h.EstadoAnterior, h.EstadoNuevo, h.Comentario, h.Usuario, h.Fecha
FROM dbo.EcfHistorial h
WHERE h.EcfId = @DocumentoId
ORDER BY h.Fecha DESC, h.Id DESC;";

        using var connection = _connectionFactory.CreateConnection();
        return (await connection.QueryAsync<DocumentoHistorialResponse>(sql, new { DocumentoId = documentoId })).ToList();
    }

    public async Task<string?> GetEstadoActualAsync(long documentoId)
    {
        const string sql = @"SELECT Estado FROM dbo.ECF WHERE ID = @Id;";

        using var connection = _connectionFactory.CreateConnection();
        return await connection.ExecuteScalarAsync<string?>(sql, new { Id = documentoId });
    }

    public async Task CambiarEstadoAsync(long documentoId, string nuevoEstado, string? comentario, string usuario)
    {
        const string insertHistorial = @"
INSERT INTO dbo.EcfHistorial (EcfId, EstadoAnterior, EstadoNuevo, Comentario, Usuario, Fecha)
SELECT @Id, ISNULL(e.Estado, ''), @NuevoEstado, @Comentario, @Usuario, SYSDATETIME()
FROM dbo.ECF e WHERE e.ID = @Id;";

        const string updateEstado = @"
UPDATE dbo.ECF
SET Estado = @NuevoEstado,
    Comentario = CONCAT(ISNULL(@Comentario, ''), ' [', @Usuario, ']')
WHERE ID = @Id;";

        using var connection = _connectionFactory.CreateConnection();
        connection.Open();
        using var transaction = connection.BeginTransaction();
        try
        {
            await connection.ExecuteAsync(insertHistorial, new { Id = documentoId, NuevoEstado = nuevoEstado, Comentario = comentario, Usuario = usuario }, transaction);
            await connection.ExecuteAsync(updateEstado, new { Id = documentoId, NuevoEstado = nuevoEstado, Comentario = comentario, Usuario = usuario }, transaction);
            transaction.Commit();
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }
}
