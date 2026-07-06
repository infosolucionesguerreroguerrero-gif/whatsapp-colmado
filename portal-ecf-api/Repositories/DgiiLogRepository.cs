using Dapper;
using PortalEcf.Api.Data;

namespace PortalEcf.Api.Repositories;

// El historial de comunicaciones con DGII usa dbo.LogsDgii (tabla opcional adicional,
// ver sql/tablas_opcionales.sql). Si no se desea crearla, puede sustituirse por
// actualizaciones a dbo.DocumentosXML.Observaciones.
public class DgiiLogRepository : IDgiiLogRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public DgiiLogRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task RegistrarComunicacionAsync(long? documentoId, string operacion, string request, string response, bool exitosa, string ambiente)
    {
        const string sql = @"
INSERT INTO dbo.LogsDgii (EcfId, Operacion, RequestBody, ResponseBody, Exitosa, Ambiente, Fecha)
VALUES (@EcfId, @Operacion, @RequestBody, @ResponseBody, @Exitosa, @Ambiente, SYSDATETIME());";

        using var connection = _connectionFactory.CreateConnection();
        await connection.ExecuteAsync(sql, new
        {
            EcfId = documentoId,
            Operacion = operacion,
            RequestBody = request,
            ResponseBody = response,
            Exitosa = exitosa,
            Ambiente = ambiente
        });
    }
}
