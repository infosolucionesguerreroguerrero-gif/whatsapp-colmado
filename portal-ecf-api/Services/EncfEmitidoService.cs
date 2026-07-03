using PortalEcf.Api.Common;
using PortalEcf.Api.Dtos;
using PortalEcf.Api.Repositories;

namespace PortalEcf.Api.Services;

public interface IEncfEmitidoService
{
    Task<PagedResponse<EncfEmitidoResponse>> GetListAsync(EncfListFilter filter);
    Task<EncfEmitidoResponse> GetByIdAsync(long id);
    Task<EncfEmitidoResponse> CrearAsync(CrearEncfRequest request, string usuario);
    Task<EnviarDgiiResponse> EnviarDgiiAsync(long id, string usuario, bool reenvio);
    Task<string> GetXmlAsync(long id);
}

public class EncfEmitidoService : IEncfEmitidoService
{
    private readonly IEncfEmitidoRepository _repository;
    private readonly IDgiiClient _dgiiClient;
    private readonly ILogger<EncfEmitidoService> _logger;

    public EncfEmitidoService(IEncfEmitidoRepository repository, IDgiiClient dgiiClient, ILogger<EncfEmitidoService> logger)
    {
        _repository = repository;
        _dgiiClient = dgiiClient;
        _logger = logger;
    }

    public Task<PagedResponse<EncfEmitidoResponse>> GetListAsync(EncfListFilter filter) =>
        _repository.GetListAsync(filter);

    public async Task<EncfEmitidoResponse> GetByIdAsync(long id) =>
        await _repository.GetByIdAsync(id)
            ?? throw new NotFoundException($"No existe el documento emitido con id {id}.");

    public async Task<EncfEmitidoResponse> CrearAsync(CrearEncfRequest request, string usuario)
    {
        var errores = new List<string>();

        if (!Validators.EsEncfValido(request.Encf))
            errores.Add("El eNCF no tiene un formato válido (ej: E310000000101).");
        if (!Validators.EsRncValido(request.RncEmisor))
            errores.Add("El RNC emisor no es válido.");
        if (!Validators.EsRncValido(request.RncComprador))
            errores.Add("El RNC comprador no es válido.");
        if (!Validators.EsTipoComprobanteValido(request.TipoDocumento))
            errores.Add("El tipo de comprobante no es válido.");
        if (request.FechaEmision == default)
            errores.Add("La fecha de emisión es requerida.");
        if (request.MontoTotal <= 0)
            errores.Add("El monto total debe ser mayor que cero.");
        if (request.TotalItbis < 0)
            errores.Add("El ITBIS no puede ser negativo.");
        if (string.IsNullOrWhiteSpace(request.XmlOriginal))
            errores.Add("El XML original es requerido (regla: guardar siempre el XML original).");
        if (!Validators.EsAmbienteValido(request.Ambiente))
            errores.Add("El ambiente debe ser CerteCF o Producción.");

        if (request.Detalles.Count > 0)
        {
            var sumaDetalles = request.Detalles.Sum(d => d.MontoLinea);
            if (Math.Abs(sumaDetalles - request.MontoTotal) > 0.01m)
                errores.Add("La suma de los detalles no coincide con el monto total.");
        }

        if (errores.Count > 0)
            throw new AppValidationException("Validación fallida.", errores);

        // Regla de negocio #1: no permitir eNCF duplicado para el mismo RNC emisor.
        if (await _repository.ExisteEncfAsync(request.Encf, request.RncEmisor))
            throw new ConflictException($"Ya existe el eNCF {request.Encf} para el emisor {request.RncEmisor}.");

        var id = await _repository.CrearAsync(request, usuario);
        _logger.LogInformation("eNCF {Encf} creado con id {Id} por {Usuario}", request.Encf, id, usuario);
        return await GetByIdAsync(id);
    }

    public async Task<EnviarDgiiResponse> EnviarDgiiAsync(long id, string usuario, bool reenvio)
    {
        var documento = await GetByIdAsync(id);

        // Regla de negocio #6: no modificar documentos aceptados.
        if (documento.Estado == "Aceptado")
            throw new ConflictException("El documento ya fue aceptado por la DGII.");

        if (!reenvio && documento.Estado == "EnProceso")
            throw new ConflictException("El documento ya está en proceso; use reenviar-dgii si desea forzar el reenvío.");

        var xmlFirmado = await _repository.GetXmlAsync(id, firmado: true)
            ?? throw new AppValidationException("El documento no tiene XML firmado. Debe firmarse antes de enviarse a la DGII.");

        var respuesta = await _dgiiClient.EnviarDocumentoAsync(id, documento.Encf, xmlFirmado, documento.Ambiente);
        await _repository.ActualizarEnvioDgiiAsync(id, respuesta.Estado, respuesta.TrackId, usuario);

        _logger.LogInformation("eNCF {Encf} (id {Id}) {Accion} a DGII por {Usuario}. Estado: {Estado}",
            documento.Encf, id, reenvio ? "reenviado" : "enviado", usuario, respuesta.Estado);

        return respuesta;
    }

    public async Task<string> GetXmlAsync(long id)
    {
        _ = await GetByIdAsync(id);
        return await _repository.GetXmlAsync(id, firmado: false)
            ?? throw new NotFoundException("El documento no tiene XML almacenado.");
    }
}
