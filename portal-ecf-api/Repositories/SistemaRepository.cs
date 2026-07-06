using Dapper;
using PortalEcf.Api.Data;

namespace PortalEcf.Api.Repositories;

// Adaptado al esquema real: dbo.AspNetUsers (rnc, RazonSocial, Ambiente, Certificate, certPassWord)
// y dbo.config (clave/valor).
public class SistemaRepository : ISistemaRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public SistemaRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<UsuarioCertificadoData?> GetEmpresaAsync(string? rnc)
    {
        const string sql = @"
SELECT TOP 1
    u.Id, u.rnc AS Rnc, u.RazonSocial, u.Ambiente, u.Certificate, u.certPassWord AS CertPassWord
FROM dbo.AspNetUsers u
WHERE u.rnc IS NOT NULL
  AND (@Rnc IS NULL OR u.rnc = @Rnc)
ORDER BY u.Id;";

        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<UsuarioCertificadoData>(sql, new { Rnc = rnc });
    }

    public async Task<string?> GetConfigAsync(string clave)
    {
        const string sql = @"SELECT TOP 1 c.valor FROM dbo.config c WHERE c.clave = @Clave;";

        using var connection = _connectionFactory.CreateConnection();
        return await connection.ExecuteScalarAsync<string?>(sql, new { Clave = clave });
    }
}
