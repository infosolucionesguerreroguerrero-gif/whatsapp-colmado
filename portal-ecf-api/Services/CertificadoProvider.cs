using System.Security.Cryptography.X509Certificates;
using PortalEcf.Api.Common;
using PortalEcf.Api.Repositories;

namespace PortalEcf.Api.Services;

/// <summary>
/// Obtiene el certificado digital (con clave privada) almacenado en dbo.AspNetUsers
/// para firmar documentos y autenticarse ante la DGII.
/// </summary>
public interface ICertificadoProvider
{
    Task<X509Certificate2> GetCertificadoAsync(string? rncEmisor = null);
}

public class CertificadoProvider : ICertificadoProvider
{
    private readonly ICertificacionRepository _repository;
    private readonly ILogger<CertificadoProvider> _logger;

    public CertificadoProvider(ICertificacionRepository repository, ILogger<CertificadoProvider> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task<X509Certificate2> GetCertificadoAsync(string? rncEmisor = null)
    {
        var usuarios = await _repository.GetUsuariosConCertificadoAsync();
        if (usuarios.Count == 0)
            throw new ConflictException("No hay ningún certificado digital registrado.");

        var candidatos = string.IsNullOrWhiteSpace(rncEmisor)
            ? usuarios
            : usuarios.Where(u => string.Equals(u.Rnc?.Trim(), rncEmisor.Trim(), StringComparison.OrdinalIgnoreCase)).ToList();

        if (candidatos.Count == 0)
            throw new NotFoundException($"No hay certificado digital registrado para el RNC {rncEmisor}.");

        X509Certificate2? vencido = null;

        foreach (var usuario in candidatos)
        {
            X509Certificate2 certificado;
            try
            {
                certificado = new X509Certificate2(
                    Convert.FromBase64String(usuario.Certificate!),
                    usuario.CertPassWord,
                    X509KeyStorageFlags.Exportable);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo cargar el certificado del RNC {Rnc}", usuario.Rnc);
                continue;
            }

            if (!certificado.HasPrivateKey)
            {
                certificado.Dispose();
                continue;
            }

            if (certificado.NotAfter <= DateTime.Now)
            {
                vencido?.Dispose();
                vencido = certificado;
                continue;
            }

            return certificado;
        }

        if (vencido is not null)
        {
            var vence = vencido.NotAfter;
            vencido.Dispose();
            throw new ConflictException($"El certificado digital está vencido desde {vence:dd/MM/yyyy}.");
        }

        throw new ConflictException("No se pudo cargar ningún certificado digital con clave privada válida.");
    }
}
