using PortalEcf.Api.Data;

namespace PortalEcf.Api.Repositories;

public interface ISistemaRepository
{
    Task<UsuarioCertificadoData?> GetEmpresaAsync(string? rnc);
    Task<string?> GetConfigAsync(string clave);
}
