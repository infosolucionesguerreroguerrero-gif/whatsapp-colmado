using System.Security.Cryptography;
using System.Text;
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
/// Servicio de firma de documentos e-CF.
/// La firma real debe implementarse con XML-DSig usando el certificado digital
/// (System.Security.Cryptography.Xml.SignedXml + X509Certificate2 del .p12).
/// Aquí se deja la estructura completa con la firma marcada como TODO.
/// </summary>
public class DocumentoFirmaService : IDocumentoFirmaService
{
    private readonly IDocumentoRepository _documentoRepository;
    private readonly IEncfEmitidoRepository _emitidoRepository;
    private readonly ILogger<DocumentoFirmaService> _logger;

    public DocumentoFirmaService(IDocumentoRepository documentoRepository,
        IEncfEmitidoRepository emitidoRepository, ILogger<DocumentoFirmaService> logger)
    {
        _documentoRepository = documentoRepository;
        _emitidoRepository = emitidoRepository;
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

        try
        {
            XDocument.Parse(xml);
        }
        catch (Exception ex)
        {
            throw new AppValidationException("El XML a firmar no es válido.", new[] { ex.Message });
        }

        // TODO: firma real con XML-DSig y el certificado activo (X509Certificate2).
        var xmlFirmado = xml; // reemplazar por el XML con el nodo <Signature>
        var huella = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(xmlFirmado)));

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

        // TODO: validación real con SignedXml.CheckSignature(certificado).
        XDocument documento;
        try
        {
            documento = XDocument.Parse(xml);
        }
        catch (Exception ex)
        {
            return new ValidarFirmaResponse { FirmaValida = false, Detalle = $"XML inválido: {ex.Message}" };
        }

        var tieneFirma = documento.Descendants().Any(e => e.Name.LocalName == "Signature");
        return new ValidarFirmaResponse
        {
            FirmaValida = tieneFirma,
            Detalle = tieneFirma ? "El documento contiene una firma XML." : "El documento no contiene nodo Signature."
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
