using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PortalEcf.Api.Common;
using PortalEcf.Api.Dtos;
using PortalEcf.Api.Services;

namespace PortalEcf.Api.Controllers;

[ApiController]
[Route("api/sistema")]
[Authorize]
public class SistemaController : ControllerBase
{
    private readonly ISistemaService _service;

    public SistemaController(ISistemaService service)
    {
        _service = service;
    }

    /// <summary>Estado del sistema: certificado, servicio DGII y ambiente actual.</summary>
    [HttpGet("estado")]
    public async Task<ActionResult<ApiResponse<SistemaEstadoResponse>>> GetEstado([FromQuery] string? rncEmpresa)
    {
        var data = await _service.GetEstadoAsync(rncEmpresa);
        return Ok(ApiResponse<SistemaEstadoResponse>.Ok(data));
    }
}
