using System.Xml.Linq;
using PortalEcf.Api.Common;
using PortalEcf.Api.Dtos;
using PortalEcf.Api.Repositories;

namespace PortalEcf.Api.Services;

public interface IDocumentoFirmaService
{
    Task<FirmarDocumentoResponse> FirmarAsync(FirmarDocumentoRequest request, string usuario);
    Task<ValidarFirmaResponse> ValidarFirmaAsync(ValidarFirmaRequest request);
    Task<PagedResponse<DocumentoFirmadoResponse>> GetFirmadosAsync(int page, int pageSize);
    Task<DocumentoFirmadoResponse> GetFirmadoByIdAsync(long id);
    Task<IReadOnlyList<DocumentoHistorialResponse>> GetHistorialAsync(long documentoId);
    Task CambiarEstadoAsync(long documentoId, CambiarEstadoRequest request, string usuario);
}

/// <summary>
/// Servicio de firma de documentos e-CF con XML-DSig (firma envuelta, RSA-SHA256)
/// usando el certificado digital de la empresa almacenado en dbo.AspNetUsers.
/// </summary>
public class DocumentoFirmaService : IDocumentoFirmaService
{
    private readonly IDocumentoRepository _documentoRepository;
    private readonly IEncfEmitidoRepository _emitidoRepository;
    private readonly ICertificadoProvider _certificadoProvider;
    private readonly IXmlSignatureService _firmaService;
    private readonly ILogger<DocumentoFirmaService> _logger;

    public DocumentoFirmaService(IDocumentoRepository documentoRepository,
        IEncfEmitidoRepository emitidoRepository, ICertificadoProvider certificadoProvider,
        IXmlSignatureService firmaService, ILogger<DocumentoFirmaService> logger)
    {
        _documentoRepository = documentoRepository;
        _emitidoRepository = emitidoRepository;
        _certificadoProvider = certificadoProvider;
        _firmaService = firmaService;
        _logger = logger;
    }

    public async Task<FirmarDocumentoResponse> FirmarAsync(FirmarDocumentoRequest request, string usuario)
    {
        string xml;
        string? encf = null;
        string? rncEmisor = null;

        if (request.DocumentoId.HasValue)
        {
            var documento = await _emitidoRepository.GetByIdAsync(request.DocumentoId.Value)
                ?? throw new NotFoundException($"No existe el documento con id {request.DocumentoId}.");

            if (documento.Estado is "Aceptado" or "Aceptado Condicional")
                throw new ConflictException("No se puede volver a firmar un documento aceptado.");

            encf = documento.Encf;
            rncEmisor = documento.RncEmisor;
            xml = await _emitidoRepository.GetXmlAsync(request.DocumentoId.Value, firmado: false)
                ?? throw new AppValidationException("El documento no tiene XML original almacenado.");
        }
        else if (!string.IsNullOrWhiteSpace(request.XmlContenido))
        {
            xml = request.XmlContenido;
        }
        else
        {
            throw new AppValidationException("Debe indicar documentoId o xmlContenido.");
        }

        XDocument documentoXml;
        try
        {
            documentoXml = XDocument.Parse(xml);
        }
        catch (Exception ex)
        {
            throw new AppValidationException("El XML a firmar no es válido.", new[] { ex.Message });
        }

        rncEmisor ??= documentoXml.Descendants()
            .FirstOrDefault(e => e.Name.LocalName.Equals("RNCEmisor", StringComparison.OrdinalIgnoreCase))?.Value.Trim();

        using var certificado = await _certificadoProvider.GetCertificadoAsync(rncEmisor);
        var xmlFirmado = _firmaService.Firmar(xml, certificado);
        var huella = certificado.Thumbprint;

        var firmaId = await _documentoRepository.RegistrarFirmaAsync(request.DocumentoId, encf, rncEmisor, xmlFirmado, huella, usuario);

        if (request.DocumentoId.HasValue)
        {
            // Regla de negocio #3: guardar el XML firmado.
            await _emitidoRepository.GuardarXmlFirmadoAsync(request.DocumentoId.Value, xmlFirmado);
        }

        _logger.LogInformation("Documento firmado (firmaId {FirmaId}, documentoId {DocumentoId}) por {Usuario}",
            firmaId, request.DocumentoId, usuario);

        return new FirmarDocumentoResponse
        {
            DocumentoId = firmaId,
            Encf = encf,
            Firmado = true,
            FechaFirma = DateTime.UtcNow,
            HuellaCertificado = huella,
            XmlFirmado = xmlFirmado
        };
    }

    public async Task<ValidarFirmaResponse> ValidarFirmaAsync(ValidarFirmaRequest request)
    {
        string xml;
        if (request.DocumentoId.HasValue)
        {
            xml = await _emitidoRepository.GetXmlAsync(request.DocumentoId.Value, firmado: true)
                ?? throw new NotFoundException("El documento no tiene XML firmado almacenado.");
        }
        else if (!string.IsNullOrWhiteSpace(request.XmlContenido))
        {
            xml = request.XmlContenido;
        }
        else
        {
            throw new AppValidationException("Debe indicar documentoId o xmlContenido.");
        }

        var resultado = _firmaService.Validar(xml);
        return new ValidarFirmaResponse
        {
            FirmaValida = resultado.Valida,
            Detalle = resultado.Detalle,
            HuellaCertificado = resultado.Huella,
            FechaFirma = resultado.FechaFirma
        };
    }

    public Task<PagedResponse<DocumentoFirmadoResponse>> GetFirmadosAsync(int page, int pageSize) =>
        _documentoRepository.GetFirmadosAsync(page, pageSize);

    public async Task<DocumentoFirmadoResponse> GetFirmadoByIdAsync(long id) =>
        await _documentoRepository.GetFirmadoByIdAsync(id)
            ?? throw new NotFoundException($"No existe el documento firmado con id {id}.");

    public async Task<IReadOnlyList<DocumentoHistorialResponse>> GetHistorialAsync(long documentoId)
    {
        var historial = await _documentoRepository.GetHistorialAsync(documentoId);
        if (historial.Count == 0 && await _documentoRepository.GetEstadoActualAsync(documentoId) is null)
            throw new NotFoundException($"No existe el documento con id {documentoId}.");
        return historial;
    }

    public async Task CambiarEstadoAsync(long documentoId, CambiarEstadoRequest request, string usuario)
    {
        if (!Validators.EsEstadoValido(request.NuevoEstado))
            throw new AppValidationException("El estado indicado no es válido. Estados: Pendiente, EnProceso, Aceptado, Aceptado Condicional, Rechazado, Error, Anulado.");

        var estadoActual = await _documentoRepository.GetEstadoActualAsync(documentoId)
            ?? throw new NotFoundException($"No existe el documento con id {documentoId}.");

        // Regla de negocio #6: los documentos aceptados solo se modifican por vía administrativa
        // (el controller exige rol Admin/Supervisor para este endpoint).
        if (estadoActual is "Aceptado" or "Aceptado Condicional" && request.NuevoEstado != "Anulado")
            throw new ConflictException("Un documento aceptado solo puede anularse mediante operación administrativa.");

        await _documentoRepository.CambiarEstadoAsync(documentoId, request.NuevoEstado, request.Comentario, usuario);
        _logger.LogInformation("Documento {Id}: estado {Anterior} -> {Nuevo} por {Usuario}",
            documentoId, estadoActual, request.NuevoEstado, usuario);
    }
}
