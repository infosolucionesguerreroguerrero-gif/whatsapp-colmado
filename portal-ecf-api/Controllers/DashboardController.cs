using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PortalEcf.Api.Common;
using PortalEcf.Api.Dtos;
using PortalEcf.Api.Services;

namespace PortalEcf.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _service;

    public DashboardController(IDashboardService service)
    {
        _service = service;
    }

    /// <summary>Indicadores del dashboard principal.</summary>
    [HttpGet("resumen")]
    public async Task<ActionResult<ApiResponse<DashboardResumenResponse>>> GetResumen([FromQuery] DashboardResumenFilter filter)
    {
        var data = await _service.GetResumenAsync(filter);
        return Ok(ApiResponse<DashboardResumenResponse>.Ok(data));
    }

    /// <summary>Tabla de actividad reciente con paginación.</summary>
    [HttpGet("actividad-reciente")]
    public async Task<ActionResult<ApiResponse<PagedResponse<ActividadRecienteItemResponse>>>> GetActividadReciente([FromQuery] ActividadRecienteFilter filter)
    {
        var data = await _service.GetActividadRecienteAsync(filter);
        return Ok(ApiResponse<PagedResponse<ActividadRecienteItemResponse>>.Ok(data));
    }
}
