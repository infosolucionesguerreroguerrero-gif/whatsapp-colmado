using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using PortalEcf.Api.Common;

namespace PortalEcf.Api.Services;

/// <summary>
/// Autenticación con la DGII: obtiene la semilla, la firma con el certificado digital
/// y canjea la semilla firmada por un token bearer. El token se reutiliza mientras esté vigente.
/// </summary>
public interface IDgiiAuthenticator
{
    Task<string> GetTokenAsync(string? ambiente, CancellationToken cancellationToken = default);
    void InvalidarToken(string? ambiente);
}

public class DgiiAuthenticator : IDgiiAuthenticator
{
    private static readonly ConcurrentDictionary<string, (string Token, DateTime Expira)> Tokens = new();
    private static readonly SemaphoreSlim Gate = new(1, 1);

    private readonly HttpClient _httpClient;
    private readonly ICertificadoProvider _certificadoProvider;
    private readonly IXmlSignatureService _firmaService;
    private readonly DgiiSettings _settings;
    private readonly ILogger<DgiiAuthenticator> _logger;

    public DgiiAuthenticator(HttpClient httpClient, ICertificadoProvider certificadoProvider,
        IXmlSignatureService firmaService, IOptions<DgiiSettings> settings, ILogger<DgiiAuthenticator> logger)
    {
        _httpClient = httpClient;
        _certificadoProvider = certificadoProvider;
        _firmaService = firmaService;
        _settings = settings.Value;
        _logger = logger;
    }

    public void InvalidarToken(string? ambiente) => Tokens.TryRemove(Clave(ambiente), out _);

    public async Task<string> GetTokenAsync(string? ambiente, CancellationToken cancellationToken = default)
    {
        var clave = Clave(ambiente);
        if (Tokens.TryGetValue(clave, out var vigente) && vigente.Expira > DateTime.UtcNow.AddMinutes(1))
            return vigente.Token;

        await Gate.WaitAsync(cancellationToken);
        try
        {
            if (Tokens.TryGetValue(clave, out vigente) && vigente.Expira > DateTime.UtcNow.AddMinutes(1))
                return vigente.Token;

            var nuevo = await AutenticarAsync(ambiente, cancellationToken);
            Tokens[clave] = nuevo;
            return nuevo.Token;
        }
        finally
        {
            Gate.Release();
        }
    }

    private async Task<(string Token, DateTime Expira)> AutenticarAsync(string? ambiente, CancellationToken cancellationToken)
    {
        var semilla = await ObtenerSemillaAsync(ambiente, cancellationToken);

        using var certificado = await _certificadoProvider.GetCertificadoAsync(_settings.RncEmisor);
        var semillaFirmada = _firmaService.Firmar(semilla, certificado);

        using var contenido = new MultipartFormDataContent();
        var archivo = new ByteArrayContent(Encoding.UTF8.GetBytes(semillaFirmada));
        archivo.Headers.ContentType = new MediaTypeHeaderValue("text/xml");
        contenido.Add(archivo, "xml", "semilla.xml");

        using var respuesta = await _httpClient.PostAsync(
            _settings.Url(_settings.Paths.ValidarSemilla, ambiente), contenido, cancellationToken);

        var cuerpo = await respuesta.Content.ReadAsStringAsync(cancellationToken);
        if (!respuesta.IsSuccessStatusCode)
            throw new ConflictException($"La DGII rechazó la semilla firmada ({(int)respuesta.StatusCode}): {Resumir(cuerpo)}");

        var (token, expira) = LeerToken(cuerpo);
        if (string.IsNullOrWhiteSpace(token))
            throw new ConflictException($"La DGII no devolvió token de autenticación: {Resumir(cuerpo)}");

        _logger.LogInformation("Token DGII obtenido para el ambiente {Ambiente}. Expira: {Expira:u}", ambiente ?? _settings.Ambiente, expira);
        return (token!, expira);
    }

    private async Task<string> ObtenerSemillaAsync(string? ambiente, CancellationToken cancellationToken)
    {
        using var respuesta = await _httpClient.GetAsync(_settings.Url(_settings.Paths.Semilla, ambiente), cancellationToken);
        var cuerpo = await respuesta.Content.ReadAsStringAsync(cancellationToken);

        if (!respuesta.IsSuccessStatusCode)
            throw new ConflictException($"No se pudo obtener la semilla de la DGII ({(int)respuesta.StatusCode}): {Resumir(cuerpo)}");

        return cuerpo;
    }

    private static (string? Token, DateTime Expira) LeerToken(string cuerpo)
    {
        using var json = JsonDocument.Parse(cuerpo);
        var raiz = json.RootElement;

        var token = Propiedad(raiz, "token") ?? Propiedad(raiz, "Token");
        var expiracion = Propiedad(raiz, "expira") ?? Propiedad(raiz, "expiracion") ?? Propiedad(raiz, "expedido");

        var expira = DateTime.TryParse(expiracion, out var fecha)
            ? fecha.ToUniversalTime()
            : DateTime.UtcNow.AddMinutes(55);

        return (token, expira);
    }

    private static string? Propiedad(JsonElement elemento, string nombre) =>
        elemento.ValueKind == JsonValueKind.Object &&
        elemento.TryGetProperty(nombre, out var valor) &&
        valor.ValueKind == JsonValueKind.String
            ? valor.GetString()
            : null;

    private static string Resumir(string cuerpo) =>
        cuerpo.Length > 500 ? cuerpo[..500] : cuerpo;

    private string Clave(string? ambiente) => DgiiSettings.Normalizar(ambiente ?? _settings.Ambiente);
}
