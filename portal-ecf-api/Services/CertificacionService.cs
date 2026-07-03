using System.Security.Cryptography.X509Certificates;
using PortalEcf.Api.Common;
using PortalEcf.Api.Dtos;
using PortalEcf.Api.Repositories;

namespace PortalEcf.Api.Services;

public interface ICertificacionService
{
    Task<CertificacionResumenResponse> GetResumenAsync();
    Task<IReadOnlyList<CertificadoResponse>> GetCertificadosAsync();
    Task<CertificadoResponse> RegistrarCertificadoAsync(RegistrarCertificadoRequest request, string usuario);
    Task<ProbarConexionDgiiResponse> ProbarConexionDgiiAsync();
}

public class CertificacionService : ICertificacionService
{
    private readonly ICertificacionRepository _repository;
    private readonly ISistemaRepository _sistemaRepository;
    private readonly IDgiiClient _dgiiClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<CertificacionService> _logger;

    public CertificacionService(ICertificacionRepository repository, ISistemaRepository sistemaRepository,
        IDgiiClient dgiiClient, IConfiguration configuration, ILogger<CertificacionService> logger)
    {
        _repository = repository;
        _sistemaRepository = sistemaRepository;
        _dgiiClient = dgiiClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<CertificacionResumenResponse> GetResumenAsync()
    {
        var resumen = await _repository.GetResumenAsync()
            ?? throw new NotFoundException("No hay información de certificación.");

        var certificados = await GetCertificadosAsync();
        var proximo = certificados
            .Where(c => c.FechaVencimiento > DateTime.MinValue)
            .OrderBy(c => c.FechaVencimiento)
            .FirstOrDefault();

        if (proximo is not null)
        {
            resumen.ProximoVencimiento = proximo.FechaVencimiento;
            resumen.DiasParaVencimiento = proximo.DiasParaVencimiento;
        }

        var diasAlerta = _configuration.GetValue("Certificado:DiasAlertaVencimiento", 30);
        resumen.AlertaVencimiento = resumen.ProximoVencimiento.HasValue && resumen.DiasParaVencimiento <= diasAlerta;
        return resumen;
    }

    public async Task<IReadOnlyList<CertificadoResponse>> GetCertificadosAsync()
    {
        var usuarios = await _repository.GetUsuariosConCertificadoAsync();
        var certificados = new List<CertificadoResponse>();
        var id = 0;

        foreach (var usuario in usuarios)
        {
            id++;
            var item = new CertificadoResponse
            {
                Id = id,
                Nombre = usuario.RazonSocial ?? usuario.Rnc ?? usuario.Id,
                Activo = true
            };

            try
            {
                var bytes = Convert.FromBase64String(usuario.Certificate!);
                using var certificado = string.IsNullOrEmpty(usuario.CertPassWord)
                    ? new X509Certificate2(bytes)
                    : new X509Certificate2(bytes, usuario.CertPassWord, X509KeyStorageFlags.EphemeralKeySet);

                item.Emisor = certificado.Issuer;
                item.NumeroSerie = certificado.SerialNumber;
                item.Huella = certificado.Thumbprint;
                item.FechaEmision = certificado.NotBefore;
                item.FechaVencimiento = certificado.NotAfter;
                item.DiasParaVencimiento = (int)(certificado.NotAfter.Date - DateTime.Today).TotalDays;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo leer el certificado del usuario {Rnc}", usuario.Rnc);
                item.Activo = false;
            }

            certificados.Add(item);
        }

        return certificados;
    }

    public async Task<CertificadoResponse> RegistrarCertificadoAsync(RegistrarCertificadoRequest request, string usuario)
    {
        var errores = new List<string>();
        if (string.IsNullOrWhiteSpace(request.Nombre)) errores.Add("El nombre (RNC de la empresa) es requerido.");
        if (string.IsNullOrWhiteSpace(request.ArchivoBase64)) errores.Add("El archivo del certificado es requerido.");
        if (string.IsNullOrWhiteSpace(request.Clave)) errores.Add("La clave del certificado es requerida.");
        if (errores.Count > 0) throw new AppValidationException("Validación fallida.", errores);

        X509Certificate2 certificado;
        try
        {
            var bytes = Convert.FromBase64String(request.ArchivoBase64);
            certificado = new X509Certificate2(bytes, request.Clave, X509KeyStorageFlags.EphemeralKeySet);
        }
        catch (Exception ex)
        {
            throw new AppValidationException("No se pudo leer el certificado.", new[] { ex.Message });
        }

        using (certificado)
        {
            if (certificado.NotAfter <= DateTime.Now)
                throw new AppValidationException("El certificado ya está vencido.");

            // El campo Nombre lleva el RNC de la empresa (dbo.AspNetUsers.rnc) a la que
            // se le asigna el certificado.
            var empresa = await _sistemaRepository.GetEmpresaAsync(request.Nombre.Trim())
                ?? throw new NotFoundException($"No existe una empresa con RNC {request.Nombre}.");

            await _repository.ActualizarCertificadoUsuarioAsync(empresa.Id, request.ArchivoBase64, request.Clave);

            _logger.LogInformation("Certificado actualizado para la empresa {Rnc} por {Usuario}. Vence: {Vence}",
                empresa.Rnc, usuario, certificado.NotAfter);

            return new CertificadoResponse
            {
                Id = 1,
                Nombre = empresa.RazonSocial ?? empresa.Rnc ?? empresa.Id,
                Emisor = certificado.Issuer,
                NumeroSerie = certificado.SerialNumber,
                Huella = certificado.Thumbprint,
                FechaEmision = certificado.NotBefore,
                FechaVencimiento = certificado.NotAfter,
                Activo = request.Activar,
                DiasParaVencimiento = (int)(certificado.NotAfter.Date - DateTime.Today).TotalDays
            };
        }
    }

    public Task<ProbarConexionDgiiResponse> ProbarConexionDgiiAsync() =>
        _dgiiClient.ProbarConexionAsync();
}
