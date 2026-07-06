using System.Globalization;
using System.Xml.Linq;
using PortalEcf.Api.Common;
using PortalEcf.Api.Dtos;
using PortalEcf.Api.Repositories;

namespace PortalEcf.Api.Services;

public interface IEncfRecibidoService
{
    Task<PagedResponse<EncfRecibidoResponse>> GetListAsync(EncfListFilter filter);
    Task<EncfRecibidoResponse> GetByIdAsync(long id);
    Task<EncfRecibidoResponse> RecibirXmlAsync(RecibirXmlRequest request, string usuario);
    Task<EncfRecibidoResponse> ValidarAsync(long id, string usuario);
    Task<string> GetXmlAsync(long id);
}

public class EncfRecibidoService : IEncfRecibidoService
{
    private readonly IEncfRecibidoRepository _repository;
    private readonly ILogger<EncfRecibidoService> _logger;

    public EncfRecibidoService(IEncfRecibidoRepository repository, ILogger<EncfRecibidoService> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public Task<PagedResponse<EncfRecibidoResponse>> GetListAsync(EncfListFilter filter) =>
        _repository.GetListAsync(filter);

    public async Task<EncfRecibidoResponse> GetByIdAsync(long id) =>
        await _repository.GetByIdAsync(id)
            ?? throw new NotFoundException($"No existe el documento recibido con id {id}.");

    public async Task<EncfRecibidoResponse> RecibirXmlAsync(RecibirXmlRequest request, string usuario)
    {
        if (string.IsNullOrWhiteSpace(request.XmlContenido))
            throw new AppValidationException("El contenido XML es requerido.");

        XDocument xml;
        try
        {
            xml = XDocument.Parse(request.XmlContenido);
        }
        catch (Exception ex)
        {
            throw new AppValidationException("El XML no es válido.", new[] { ex.Message });
        }

        // Extracción básica según el esquema e-CF de la DGII (ECF/Encabezado).
        // Ajustar los nombres de elementos al esquema real utilizado.
        string GetValor(params string[] nombres) =>
            nombres.Select(n => xml.Descendants().FirstOrDefault(e => e.Name.LocalName == n)?.Value)
                   .FirstOrDefault(v => !string.IsNullOrWhiteSpace(v)) ?? string.Empty;

        var encf = request.Encf ?? GetValor("eNCF", "ENCF");
        var rncEmisor = request.RncEmisor ?? GetValor("RNCEmisor");
        var rncComprador = GetValor("RNCComprador");
        var tipoDocumento = GetValor("TipoeCF", "TipoECF");
        var fechaTexto = GetValor("FechaEmision");
        var montoTexto = GetValor("MontoTotal");
        var itbisTexto = GetValor("TotalITBIS", "TotalItbis");

        var errores = new List<string>();
        if (!Validators.EsEncfValido(encf)) errores.Add("El eNCF del XML no es válido.");
        if (!Validators.EsRncValido(rncEmisor)) errores.Add("El RNC emisor del XML no es válido.");
        if (!DateTime.TryParse(fechaTexto, CultureInfo.InvariantCulture, DateTimeStyles.None, out var fechaEmision))
            errores.Add("La fecha de emisión del XML no es válida.");
        if (!decimal.TryParse(montoTexto, NumberStyles.Number, CultureInfo.InvariantCulture, out var montoTotal) || montoTotal <= 0)
            errores.Add("El monto total del XML no es válido.");
        decimal.TryParse(itbisTexto, NumberStyles.Number, CultureInfo.InvariantCulture, out var totalItbis);

        if (errores.Count > 0)
            throw new AppValidationException("El XML recibido no pasó las validaciones.", errores);

        if (await _repository.ExisteEncfAsync(encf, rncEmisor))
            throw new ConflictException($"Ya existe el eNCF {encf} recibido del emisor {rncEmisor}.");

        var id = await _repository.RecibirXmlAsync(request, encf, rncEmisor, rncComprador,
            string.IsNullOrWhiteSpace(tipoDocumento) ? encf.Substring(1, 2) : tipoDocumento,
            fechaEmision, montoTotal, totalItbis, usuario);

        _logger.LogInformation("XML recibido: eNCF {Encf} de {RncEmisor}, id {Id}", encf, rncEmisor, id);
        return await GetByIdAsync(id);
    }

    public async Task<EncfRecibidoResponse> ValidarAsync(long id, string usuario)
    {
        var documento = await GetByIdAsync(id);

        if (documento.Estado == "Aceptado")
            throw new ConflictException("El documento ya fue validado y aceptado.");

        var xml = await _repository.GetXmlAsync(id)
            ?? throw new AppValidationException("El documento no tiene XML almacenado.");

        var errores = new List<string>();
        try
        {
            XDocument.Parse(xml);
        }
        catch (Exception ex)
        {
            errores.Add($"XML inválido: {ex.Message}");
        }

        var nuevoEstado = errores.Count == 0 ? "Aceptado" : "Rechazado";
        var comentario = errores.Count == 0 ? "Validación exitosa" : string.Join("; ", errores);

        await _repository.ActualizarEstadoAsync(id, nuevoEstado, comentario, usuario);
        _logger.LogInformation("Documento recibido {Id} validado: {Estado}", id, nuevoEstado);

        return await GetByIdAsync(id);
    }

    public async Task<string> GetXmlAsync(long id)
    {
        _ = await GetByIdAsync(id);
        return await _repository.GetXmlAsync(id)
            ?? throw new NotFoundException("El documento no tiene XML almacenado.");
    }
}
