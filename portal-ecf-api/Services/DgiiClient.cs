using System.Text.Json;
using PortalEcf.Api.Dtos;
using PortalEcf.Api.Repositories;

namespace PortalEcf.Api.Services;

/// <summary>
/// Implementación de ejemplo de IDgiiClient.
/// Reemplazar las llamadas simuladas por el consumo real de los servicios de la DGII
/// (URLs configuradas en appsettings: Dgii:UrlRecepcion, Dgii:UrlConsulta, etc.).
/// Registra request/response de cada comunicación en LogsDgii (regla de negocio #5).
/// </summary>
public class DgiiClient : IDgiiClient
{
    private readonly HttpClient _httpClient;
    private readonly IDgiiLogRepository _logRepository;
    private readonly IConfiguration _configuration;
    private readonly ILogger<DgiiClient> _logger;

    public DgiiClient(HttpClient httpClient, IDgiiLogRepository logRepository, IConfiguration configuration, ILogger<DgiiClient> logger)
    {
        _httpClient = httpClient;
        _logRepository = logRepository;
        _configuration = configuration;
        _logger = logger;
    }

    private string Ambiente => _configuration["Dgii:Ambiente"] ?? "TestECF";

    public async Task<EnviarDgiiResponse> EnviarDocumentoAsync(long documentoId, string encf, string xmlFirmado, string ambiente)
    {
        var requestBody = JsonSerializer.Serialize(new { encf, ambiente });
        try
        {
            // TODO: llamada real -> POST {Dgii:UrlRecepcion} con el XML firmado.
            var response = new EnviarDgiiResponse
            {
                DocumentoId = documentoId,
                Encf = encf,
                TrackId = Guid.NewGuid().ToString(),
                Estado = "EnProceso",
                MensajeDgii = "Documento recibido por DGII (simulado)"
            };

            await _logRepository.RegistrarComunicacionAsync(documentoId, "EnviarDocumento",
                requestBody, JsonSerializer.Serialize(response), true, ambiente);

            _logger.LogInformation("Documento {DocumentoId} ({Encf}) enviado a DGII. TrackId: {TrackId}",
                documentoId, encf, response.TrackId);

            return response;
        }
        catch (Exception ex)
        {
            await _logRepository.RegistrarComunicacionAsync(documentoId, "EnviarDocumento",
                requestBody, ex.Message, false, ambiente);
            throw;
        }
    }

    public async Task<ConsultaDgiiResponse> ConsultarEncfAsync(ConsultaDgiiRequest request)
    {
        var requestBody = JsonSerializer.Serialize(request);
        try
        {
            // TODO: llamada real -> GET {Dgii:UrlConsulta}?rncEmisor=...&encf=...&codigoSeguridad=...
            var response = new ConsultaDgiiResponse
            {
                Encontrado = true,
                Encf = request.Encf,
                RncEmisor = request.RncEmisor,
                RncComprador = request.RncComprador,
                Estado = "Aceptado",
                FechaEmision = request.FechaEmision,
                MontoTotal = request.MontoTotal,
                MensajeDgii = "Consulta realizada (simulada)"
            };

            await _logRepository.RegistrarComunicacionAsync(null, "ConsultarEncf",
                requestBody, JsonSerializer.Serialize(response), true, Ambiente);

            return response;
        }
        catch (Exception ex)
        {
            await _logRepository.RegistrarComunicacionAsync(null, "ConsultarEncf",
                requestBody, ex.Message, false, Ambiente);
            throw;
        }
    }

    public async Task<DgiiEstadoServicioResponse> ConsultarEstadoServicioAsync()
    {
        try
        {
            var url = _configuration["Dgii:UrlEstadoServicio"];
            var enLinea = true;
            if (!string.IsNullOrWhiteSpace(url))
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
                var httpResponse = await _httpClient.GetAsync(url, cts.Token);
                enLinea = httpResponse.IsSuccessStatusCode;
            }

            return new DgiiEstadoServicioResponse
            {
                EnLinea = enLinea,
                Estado = enLinea ? "En línea" : "Fuera de línea",
                Ambiente = Ambiente,
                FechaConsulta = DateTime.UtcNow
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Servicio DGII no disponible");
            return new DgiiEstadoServicioResponse
            {
                EnLinea = false,
                Estado = "Fuera de línea",
                Ambiente = Ambiente,
                FechaConsulta = DateTime.UtcNow
            };
        }
    }

    public async Task<DgiiEstadoDocumentoResponse> ConsultarEstadoDocumentoAsync(long documentoId, string? trackId, string? encf)
    {
        var requestBody = JsonSerializer.Serialize(new { documentoId, trackId, encf });
        try
        {
            // TODO: llamada real -> GET {Dgii:UrlConsultaEstado}?trackId=...
            var response = new DgiiEstadoDocumentoResponse
            {
                DocumentoId = documentoId,
                Encf = encf,
                TrackId = trackId,
                Estado = "EnProceso",
                MensajeDgii = "Consulta de estado (simulada)",
                FechaConsulta = DateTime.UtcNow
            };

            await _logRepository.RegistrarComunicacionAsync(documentoId, "ConsultarEstadoDocumento",
                requestBody, JsonSerializer.Serialize(response), true, Ambiente);

            return response;
        }
        catch (Exception ex)
        {
            await _logRepository.RegistrarComunicacionAsync(documentoId, "ConsultarEstadoDocumento",
                requestBody, ex.Message, false, Ambiente);
            throw;
        }
    }

    public async Task<ProbarConexionDgiiResponse> ProbarConexionAsync()
    {
        var estado = await ConsultarEstadoServicioAsync();
        var resultado = new ProbarConexionDgiiResponse
        {
            Exitosa = estado.EnLinea,
            Ambiente = Ambiente,
            Detalle = estado.Estado,
            Fecha = DateTime.UtcNow
        };

        await _logRepository.RegistrarComunicacionAsync(null, "ProbarConexion",
            "{}", JsonSerializer.Serialize(resultado), resultado.Exitosa, Ambiente);

        return resultado;
    }
}
