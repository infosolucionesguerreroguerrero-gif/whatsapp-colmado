using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PortalEcf.Api.Common;
using PortalEcf.Api.Dtos;
using PortalEcf.Api.Services;

namespace PortalEcf.Api.Controllers;

[ApiController]
[Route("api/documentos")]
[Authorize]
public class DocumentosController : ControllerBase
{
    private readonly IDocumentoFirmaService _service;

    public DocumentosController(IDocumentoFirmaService service)
    {
        _service = service;
    }

    private string Usuario => User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "sistema";

    [HttpPost("firmar")]
    public async Task<ActionResult<ApiResponse<FirmarDocumentoResponse>>> Firmar([FromBody] FirmarDocumentoRequest request)
    {
        var data = await _service.FirmarAsync(request, Usuario);
        return Ok(ApiResponse<FirmarDocumentoResponse>.Ok(data, "Documento firmado correctamente"));
    }

    [HttpPost("validar-firma")]
    public async Task<ActionResult<ApiResponse<ValidarFirmaResponse>>> ValidarFirma([FromBody] ValidarFirmaRequest request)
    {
        var data = await _service.ValidarFirmaAsync(request);
        return Ok(ApiResponse<ValidarFirmaResponse>.Ok(data));
    }

    [HttpGet("firmados")]
    public async Task<ActionResult<ApiResponse<PagedResponse<DocumentoFirmadoResponse>>>> GetFirmados(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var data = await _service.GetFirmadosAsync(page, pageSize);
        return Ok(ApiResponse<PagedResponse<DocumentoFirmadoResponse>>.Ok(data));
    }

    [HttpGet("firmados/{id:long}")]
    public async Task<ActionResult<ApiResponse<DocumentoFirmadoResponse>>> GetFirmadoById(long id)
    {
        var data = await _service.GetFirmadoByIdAsync(id);
        return Ok(ApiResponse<DocumentoFirmadoResponse>.Ok(data));
    }

    [HttpGet("{id:long}/historial")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<DocumentoHistorialResponse>>>> GetHistorial(long id)
    {
        var data = await _service.GetHistorialAsync(id);
        return Ok(ApiResponse<IReadOnlyList<DocumentoHistorialResponse>>.Ok(data));
    }

    /// <summary>Cambio manual de estado (solo Admin o Supervisor).</summary>
    [HttpPut("{id:long}/estado")]
    [Authorize(Roles = "Admin,Supervisor")]
    public async Task<ActionResult<ApiResponse>> CambiarEstado(long id, [FromBody] CambiarEstadoRequest request)
    {
        await _service.CambiarEstadoAsync(id, request, Usuario);
        return Ok(ApiResponse.Ok("Estado actualizado correctamente"));
    }
}
