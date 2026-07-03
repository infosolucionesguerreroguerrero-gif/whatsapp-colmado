using System.Security.Cryptography.X509Certificates;
using PortalEcf.Api.Common;
using PortalEcf.Api.Dtos;
using PortalEcf.Api.Repositories;

namespace PortalEcf.Api.Services;

public interface ISistemaService
{
    Task<SistemaEstadoResponse> GetEstadoAsync(string? rncEmpresa);
}

public class SistemaService : ISistemaService
{
    private readonly ISistemaRepository _repository;
    private readonly IDgiiClient _dgiiClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<SistemaService> _logger;

    public SistemaService(ISistemaRepository repository, IDgiiClient dgiiClient,
        IConfiguration configuration, ILogger<SistemaService> logger)
    {
        _repository = repository;
        _dgiiClient = dgiiClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<SistemaEstadoResponse> GetEstadoAsync(string? rncEmpresa)
    {
        var empresa = await _repository.GetEmpresaAsync(rncEmpresa)
            ?? throw new NotFoundException("No se encontró información de la empresa.");

        var estado = new SistemaEstadoResponse
        {
            RncEmpresa = empresa.Rnc ?? string.Empty,
            NombreEmpresa = empresa.RazonSocial ?? string.Empty,
            AmbienteActual = empresa.Ambiente
                ?? await _repository.GetConfigAsync("Ambiente")
                ?? "TestECF"
        };

        // El certificado se almacena en dbo.AspNetUsers.Certificate (base64);
        // la fecha de vencimiento se calcula cargando el X509.
        if (!string.IsNullOrWhiteSpace(empresa.Certificate))
        {
            try
            {
                var bytes = Convert.FromBase64String(empresa.Certificate);
                using var certificado = string.IsNullOrEmpty(empresa.CertPassWord)
                    ? new X509Certificate2(bytes)
                    : new X509Certificate2(bytes, empresa.CertPassWord, X509KeyStorageFlags.EphemeralKeySet);

                estado.FechaVencimientoCertificado = certificado.NotAfter;
                estado.DiasVencimientoCertificado = (int)(certificado.NotAfter.Date - DateTime.Today).TotalDays;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo leer el certificado de la empresa {Rnc}", empresa.Rnc);
            }
        }

        var servicio = await _dgiiClient.ConsultarEstadoServicioAsync();
        estado.ServicioDgiiEnLinea = servicio.EnLinea;
        estado.EstadoServicioDgii = servicio.Estado;

        var diasAlerta = _configuration.GetValue("Certificado:DiasAlertaVencimiento", 30);
        estado.AlertaCertificado = estado.FechaVencimientoCertificado.HasValue
            && estado.DiasVencimientoCertificado <= diasAlerta;

        return estado;
    }
}
