using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using PortalEcf.Api.Common;
using PortalEcf.Api.Dtos;
using PortalEcf.Api.Repositories;

namespace PortalEcf.Api.Services;

/// <summary>
/// Cliente de los servicios web de la DGII (autenticación por semilla firmada, recepción de e-CF,
/// consulta de estado por TrackId, consulta de e-NCF y estatus de los servicios).
/// Registra request/response de cada comunicación en LogsDgii (regla de negocio #5).
/// </summary>
public class DgiiClient : IDgiiClient
{
    private readonly HttpClient _httpClient;
    private readonly IDgiiAuthenticator _autenticador;
    private readonly IDgiiLogRepository _logRepository;
    private readonly DgiiSettings _settings;
    private readonly ILogger<DgiiClient> _logger;

    public DgiiClient(HttpClient httpClient, IDgiiAuthenticator autenticador, IDgiiLogRepository logRepository,
        IOptions<DgiiSettings> settings, ILogger<DgiiClient> logger)
    {
        _httpClient = httpClient;
        _autenticador = autenticador;
        _logRepository = logRepository;
        _settings = settings.Value;
        _logger = logger;
    }

    private string Ambiente => _settings.Ambiente;

    public async Task<EnviarDgiiResponse> EnviarDocumentoAsync(long documentoId, string encf, string xmlFirmado, string ambiente)
    {
        var url = _settings.Url(_settings.Paths.Recepcion, ambiente);
        var requestBody = JsonSerializer.Serialize(new { url, encf, ambiente });

        try
        {
            var token = await _autenticador.GetTokenAsync(ambiente);

            using var contenido = new MultipartFormDataContent();
            var archivo = new ByteArrayContent(Encoding.UTF8.GetBytes(xmlFirmado));
            archivo.Headers.ContentType = new MediaTypeHeaderValue("text/xml");
            contenido.Add(archivo, "xml", NombreArchivo(xmlFirmado, encf));

            using var peticion = new HttpRequestMessage(HttpMethod.Post, url) { Content = contenido };
            peticion.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

            using var respuesta = await _httpClient.SendAsync(peticion);
            var cuerpo = await respuesta.Content.ReadAsStringAsync();

            await _logRepository.RegistrarComunicacionAsync(documentoId, "EnviarDocumento",
                requestBody, cuerpo, respuesta.IsSuccessStatusCode, ambiente);

            if (respuesta.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                _autenticador.InvalidarToken(ambiente);

            if (!respuesta.IsSuccessStatusCode)
                throw new ConflictException($"La DGII rechazó el envío ({(int)respuesta.StatusCode}): {Resumir(cuerpo)}");

            var raiz = LeerJson(cuerpo);
            var resultado = new EnviarDgiiResponse
            {
                DocumentoId = documentoId,
                Encf = encf,
                TrackId = Texto(raiz, "trackId", "trackid", "TrackId"),
                Estado = MapearEstado(Texto(raiz, "estado", "Estado")) ?? "EnProceso",
                MensajeDgii = Texto(raiz, "mensaje", "Mensaje", "mensajes") ?? "Documento recibido por la DGII."
            };

            _logger.LogInformation("Documento {DocumentoId} ({Encf}) enviado a DGII. TrackId: {TrackId}",
                documentoId, encf, resultado.TrackId);

            return resultado;
        }
        catch (Exception ex) when (ex is not ConflictException)
        {
            await _logRepository.RegistrarComunicacionAsync(documentoId, "EnviarDocumento",
                requestBody, ex.Message, false, ambiente);
            throw;
        }
    }

    public async Task<ConsultaDgiiResponse> ConsultarEncfAsync(ConsultaDgiiRequest request)
    {
        var query = new Dictionary<string, string?>
        {
            ["rncEmisor"] = request.RncEmisor,
            ["ncfElectronico"] = request.Encf,
            ["rncComprador"] = request.RncComprador,
            ["codigoSeguridad"] = request.CodigoSeguridad
        };

        var url = ConQuery(_settings.Url(_settings.Paths.ConsultaEcf), query);
        var requestBody = JsonSerializer.Serialize(new { url, request });

        try
        {
            var token = await _autenticador.GetTokenAsync(Ambiente);

            using var peticion = new HttpRequestMessage(HttpMethod.Get, url);
            peticion.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

            using var respuesta = await _httpClient.SendAsync(peticion);
            var cuerpo = await respuesta.Content.ReadAsStringAsync();

            await _logRepository.RegistrarComunicacionAsync(null, "ConsultarEncf",
                requestBody, cuerpo, respuesta.IsSuccessStatusCode, Ambiente);

            if (respuesta.StatusCode == System.Net.HttpStatusCode.NotFound)
                return new ConsultaDgiiResponse
                {
                    Encontrado = false,
                    Encf = request.Encf,
                    RncEmisor = request.RncEmisor,
                    MensajeDgii = "La DGII no tiene registro de este e-NCF."
                };

            if (respuesta.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                _autenticador.InvalidarToken(Ambiente);

            if (!respuesta.IsSuccessStatusCode)
                throw new ConflictException($"Error consultando el e-NCF en la DGII ({(int)respuesta.StatusCode}): {Resumir(cuerpo)}");

            var raiz = LeerJson(cuerpo);
            return new ConsultaDgiiResponse
            {
                Encontrado = true,
                Encf = Texto(raiz, "encf", "eNCF", "ncfElectronico") ?? request.Encf,
                RncEmisor = Texto(raiz, "rncEmisor", "RNCEmisor") ?? request.RncEmisor,
                RncComprador = Texto(raiz, "rncComprador", "RNCComprador") ?? request.RncComprador,
                Estado = MapearEstado(Texto(raiz, "estado", "Estado")) ?? "Desconocido",
                FechaEmision = Fecha(raiz, "fechaEmision", "FechaEmision") ?? request.FechaEmision,
                MontoTotal = Monto(raiz, "montoTotal", "MontoTotal") ?? request.MontoTotal,
                MensajeDgii = Texto(raiz, "mensaje", "Mensaje")
            };
        }
        catch (Exception ex) when (ex is not ConflictException)
        {
            await _logRepository.RegistrarComunicacionAsync(null, "ConsultarEncf",
                requestBody, ex.Message, false, Ambiente);
            throw;
        }
    }

    public async Task<DgiiEstadoServicioResponse> ConsultarEstadoServicioAsync()
    {
        var url = _settings.Url(_settings.Paths.EstatusServicios);
        try
        {
            using var respuesta = await _httpClient.GetAsync(url);
            var cuerpo = await respuesta.Content.ReadAsStringAsync();
            var enLinea = respuesta.IsSuccessStatusCode && !cuerpo.Contains("fuera de servicio", StringComparison.OrdinalIgnoreCase);

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
            _logger.LogWarning(ex, "Servicio DGII no disponible ({Url})", url);
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
        if (string.IsNullOrWhiteSpace(trackId))
            throw new AppValidationException("El documento no tiene TrackId; debe enviarse a la DGII antes de consultar su estado.");

        var url = ConQuery(_settings.Url(_settings.Paths.ConsultaEstado), new Dictionary<string, string?> { ["trackid"] = trackId });
        var requestBody = JsonSerializer.Serialize(new { url, documentoId, trackId, encf });

        try
        {
            var token = await _autenticador.GetTokenAsync(Ambiente);

            using var peticion = new HttpRequestMessage(HttpMethod.Get, url);
            peticion.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

            using var respuesta = await _httpClient.SendAsync(peticion);
            var cuerpo = await respuesta.Content.ReadAsStringAsync();

            await _logRepository.RegistrarComunicacionAsync(documentoId, "ConsultarEstadoDocumento",
                requestBody, cuerpo, respuesta.IsSuccessStatusCode, Ambiente);

            if (respuesta.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                _autenticador.InvalidarToken(Ambiente);

            if (!respuesta.IsSuccessStatusCode)
                throw new ConflictException($"Error consultando el estado en la DGII ({(int)respuesta.StatusCode}): {Resumir(cuerpo)}");

            var raiz = LeerJson(cuerpo);
            return new DgiiEstadoDocumentoResponse
            {
                DocumentoId = documentoId,
                Encf = Texto(raiz, "encf", "eNCF") ?? encf,
                TrackId = Texto(raiz, "trackId", "trackid") ?? trackId,
                Estado = MapearEstado(Texto(raiz, "estado", "Estado")) ?? "EnProceso",
                MensajeDgii = Mensajes(raiz),
                FechaConsulta = DateTime.UtcNow
            };
        }
        catch (Exception ex) when (ex is not ConflictException)
        {
            await _logRepository.RegistrarComunicacionAsync(documentoId, "ConsultarEstadoDocumento",
                requestBody, ex.Message, false, Ambiente);
            throw;
        }
    }

    public async Task<ProbarConexionDgiiResponse> ProbarConexionAsync()
    {
        var resultado = new ProbarConexionDgiiResponse { Ambiente = Ambiente, Fecha = DateTime.UtcNow };
        try
        {
            // La prueba real de conexión incluye el ciclo completo semilla -> firma -> token.
            _autenticador.InvalidarToken(Ambiente);
            await _autenticador.GetTokenAsync(Ambiente);
            resultado.Exitosa = true;
            resultado.Detalle = "Autenticación con la DGII exitosa (semilla firmada y token obtenido).";
        }
        catch (Exception ex)
        {
            resultado.Exitosa = false;
            resultado.Detalle = ex.Message;
            _logger.LogWarning(ex, "Falló la prueba de conexión con la DGII");
        }

        await _logRepository.RegistrarComunicacionAsync(null, "ProbarConexion",
            "{}", JsonSerializer.Serialize(resultado), resultado.Exitosa, Ambiente);

        return resultado;
    }

    /// <summary>La DGII exige que el archivo se llame {RNCEmisor}{eNCF}.xml.</summary>
    private static string NombreArchivo(string xmlFirmado, string encf)
    {
        var rnc = System.Text.RegularExpressions.Regex.Match(xmlFirmado,
            "<RNCEmisor>\\s*([0-9]+)\\s*</RNCEmisor>",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        return rnc.Success ? $"{rnc.Groups[1].Value}{encf}.xml" : $"{encf}.xml";
    }

    private static string Resumir(string cuerpo) =>
        cuerpo.Length > 500 ? cuerpo[..500] : cuerpo;

    private static string ConQuery(string url, IDictionary<string, string?> parametros)
    {
        var query = string.Join('&', parametros
            .Where(p => !string.IsNullOrWhiteSpace(p.Value))
            .Select(p => $"{Uri.EscapeDataString(p.Key)}={Uri.EscapeDataString(p.Value!)}"));

        return string.IsNullOrEmpty(query) ? url : $"{url}?{query}";
    }

    private static JsonElement? LeerJson(string cuerpo)
    {
        if (string.IsNullOrWhiteSpace(cuerpo)) return null;
        try
        {
            return JsonDocument.Parse(cuerpo).RootElement.Clone();
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? Texto(JsonElement? raiz, params string[] nombres)
    {
        if (raiz is not { ValueKind: JsonValueKind.Object } elemento) return null;

        foreach (var nombre in nombres)
        {
            if (!elemento.TryGetProperty(nombre, out var valor)) continue;
            var texto = valor.ValueKind switch
            {
                JsonValueKind.String => valor.GetString(),
                JsonValueKind.Number => valor.ToString(),
                _ => null
            };
            if (!string.IsNullOrWhiteSpace(texto)) return texto;
        }

        return null;
    }

    private static DateTime? Fecha(JsonElement? raiz, params string[] nombres) =>
        DateTime.TryParse(Texto(raiz, nombres), out var fecha) ? fecha : null;

    private static decimal? Monto(JsonElement? raiz, params string[] nombres) =>
        decimal.TryParse(Texto(raiz, nombres), System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var monto)
            ? monto
            : null;

    private static string? Mensajes(JsonElement? raiz)
    {
        if (raiz is not { ValueKind: JsonValueKind.Object } elemento) return null;

        if (elemento.TryGetProperty("mensajes", out var mensajes) && mensajes.ValueKind == JsonValueKind.Array)
        {
            var textos = mensajes.EnumerateArray()
                .Select(m => m.ValueKind == JsonValueKind.Object
                    ? Texto(m, "valor", "mensaje", "descripcion")
                    : m.GetString())
                .Where(t => !string.IsNullOrWhiteSpace(t));

            var resultado = string.Join(" | ", textos);
            if (!string.IsNullOrWhiteSpace(resultado)) return resultado;
        }

        return Texto(elemento, "mensaje", "Mensaje");
    }

    /// <summary>Normaliza los estados devueltos por la DGII a los estados internos del portal.</summary>
    private static string? MapearEstado(string? estado)
    {
        if (string.IsNullOrWhiteSpace(estado)) return null;

        return estado.Trim().ToLowerInvariant() switch
        {
            "0" or "no encontrado" => "Pendiente",
            "1" or "aceptado" => "Aceptado",
            "2" or "rechazado" => "Rechazado",
            "3" or "en proceso" or "enproceso" => "EnProceso",
            "4" or "aceptado condicional" => "Aceptado Condicional",
            _ => estado.Trim()
        };
    }
}
