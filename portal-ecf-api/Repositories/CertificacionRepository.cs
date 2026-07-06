using Dapper;
using PortalEcf.Api.Data;
using PortalEcf.Api.Dtos;

namespace PortalEcf.Api.Repositories;

// Adaptado al esquema real: dbo.ecfCertef (documentos del proceso de certificación CerteCF),
// dbo.AspNetUsers (certificado digital por empresa) y dbo.DgiiTokens (autenticación con DGII).
public class CertificacionRepository : ICertificacionRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public CertificacionRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<CertificacionResumenResponse?> GetResumenAsync()
    {
        const string sql = @"
SELECT
    AmbienteActual = ISNULL((SELECT TOP 1 c.valor FROM dbo.config c WHERE c.clave = 'Ambiente'), 'TestECF'),
    CertificadosActivos = (SELECT COUNT(1) FROM dbo.AspNetUsers u WHERE u.Certificate IS NOT NULL),
    PruebasRealizadas = (SELECT COUNT(1) FROM dbo.ecfCertef),
    PruebasExitosas = (SELECT COUNT(1) FROM dbo.ecfCertef c WHERE c.Estado IN ('Aceptado', 'Aceptado Condicional')),
    UltimaConexionDgii = (SELECT MAX(t.FechaCreacion) FROM dbo.DgiiTokens t);";

        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<CertificacionResumenResponse>(sql);
    }

    public async Task<IReadOnlyList<UsuarioCertificadoData>> GetUsuariosConCertificadoAsync()
    {
        const string sql = @"
SELECT u.Id, u.rnc AS Rnc, u.RazonSocial, u.Ambiente, u.Certificate, u.certPassWord AS CertPassWord
FROM dbo.AspNetUsers u
WHERE u.Certificate IS NOT NULL;";

        using var connection = _connectionFactory.CreateConnection();
        return (await connection.QueryAsync<UsuarioCertificadoData>(sql)).ToList();
    }

    public async Task ActualizarCertificadoUsuarioAsync(string userId, string certificadoBase64, string clave)
    {
        const string sql = @"
UPDATE dbo.AspNetUsers
SET Certificate = @Certificado, certPassWord = @Clave
WHERE Id = @UserId;";

        using var connection = _connectionFactory.CreateConnection();
        await connection.ExecuteAsync(sql, new { UserId = userId, Certificado = certificadoBase64, Clave = clave });
    }
}
