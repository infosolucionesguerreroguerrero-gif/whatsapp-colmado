using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PortalEcf.Api.Common;
using PortalEcf.Api.Dtos;
using PortalEcf.Api.Repositories;
using PortalEcf.Api.Services;

namespace PortalEcf.Api.Controllers;

[ApiController]
[Route("api/dgii")]
[Authorize]
public class DgiiController : ControllerBase
{
    private readonly IDgiiClient _dgiiClient;
    private readonly IEncfEmitidoRepository _emitidoRepository;

    public DgiiController(IDgiiClient dgiiClient, IEncfEmitidoRepository emitidoRepository)
    {
        _dgiiClient = dgiiClient;
        _emitidoRepository = emitidoRepository;
    }

    /// <summary>Consulta de un e-NCF directamente en la DGII.</summary>
    [HttpGet("consulta-encf")]
    public async Task<ActionResult<ApiResponse<ConsultaDgiiResponse>>> ConsultaEncf([FromQuery] ConsultaDgiiRequest request)
    {
        var errores = new List<string>();
        if (!Validators.EsRncValido(request.RncEmisor)) errores.Add("El RNC emisor no es válido.");
        if (!Validators.EsEncfValido(request.Encf)) errores.Add("El eNCF no es válido.");
        if (request.RncComprador is not null && !Validators.EsRncValido(request.RncComprador))
            errores.Add("El RNC comprador no es válido.");
        if (errores.Count > 0) throw new AppValidationException("Validación fallida.", errores);

        var data = await _dgiiClient.ConsultarEncfAsync(request);
        return Ok(ApiResponse<ConsultaDgiiResponse>.Ok(data));
    }

    /// <summary>Estado del servicio de la DGII.</summary>
    [HttpGet("estado-servicio")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<DgiiEstadoServicioResponse>>> EstadoServicio()
    {
        var data = await _dgiiClient.ConsultarEstadoServicioAsync();
        return Ok(ApiResponse<DgiiEstadoServicioResponse>.Ok(data));
    }

    /// <summary>Estado de un documento en la DGII (por TrackId).</summary>
    [HttpGet("documentos/{id:long}/estado")]
    public async Task<ActionResult<ApiResponse<DgiiEstadoDocumentoResponse>>> EstadoDocumento(long id)
    {
        var documento = await _emitidoRepository.GetByIdAsync(id)
            ?? throw new NotFoundException($"No existe el documento con id {id}.");

        var data = await _dgiiClient.ConsultarEstadoDocumentoAsync(id, documento.TrackIdDgii, documento.Encf);
        return Ok(ApiResponse<DgiiEstadoDocumentoResponse>.Ok(data));
    }
}
