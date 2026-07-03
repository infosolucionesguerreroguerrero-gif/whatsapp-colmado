using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PortalEcf.Api.Common;
using PortalEcf.Api.Dtos;
using PortalEcf.Api.Services;

namespace PortalEcf.Api.Controllers;

[ApiController]
[Route("api/busqueda")]
[Authorize]
public class BusquedaController : ControllerBase
{
    private readonly IDashboardService _service;

    public BusquedaController(IDashboardService service)
    {
        _service = service;
    }

    /// <summary>Buscador global por eNCF, RNC, razón social o número interno.</summary>
    [HttpGet("global")]
    public async Task<ActionResult<ApiResponse<GlobalSearchResponse>>> Global([FromQuery] string term)
    {
        var data = await _service.GlobalSearchAsync(term);
        return Ok(ApiResponse<GlobalSearchResponse>.Ok(data));
    }
}
