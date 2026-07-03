using PortalEcf.Api.Data;
using PortalEcf.Api.Dtos;

namespace PortalEcf.Api.Repositories;

public interface ICertificacionRepository
{
    Task<CertificacionResumenResponse?> GetResumenAsync();
    Task<IReadOnlyList<UsuarioCertificadoData>> GetUsuariosConCertificadoAsync();
    Task ActualizarCertificadoUsuarioAsync(string userId, string certificadoBase64, string clave);
}
