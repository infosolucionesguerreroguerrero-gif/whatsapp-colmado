using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PortalEcf.Api.Common;
using PortalEcf.Api.Dtos;
using PortalEcf.Api.Services;

namespace PortalEcf.Api.Controllers;

[ApiController]
[Route("api/encf/recibidos")]
[Authorize]
public class EncfRecibidosController : ControllerBase
{
    private readonly IEncfRecibidoService _service;

    public EncfRecibidosController(IEncfRecibidoService service)
    {
        _service = service;
    }

    private string Usuario => User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "sistema";

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResponse<EncfRecibidoResponse>>>> GetList([FromQuery] EncfListFilter filter)
    {
        var data = await _service.GetListAsync(filter);
        return Ok(ApiResponse<PagedResponse<EncfRecibidoResponse>>.Ok(data));
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse<EncfRecibidoResponse>>> GetById(long id)
    {
        var data = await _service.GetByIdAsync(id);
        return Ok(ApiResponse<EncfRecibidoResponse>.Ok(data));
    }

    [HttpPost("recibir-xml")]
    public async Task<ActionResult<ApiResponse<EncfRecibidoResponse>>> RecibirXml([FromBody] RecibirXmlRequest request)
    {
        var data = await _service.RecibirXmlAsync(request, Usuario);
        return CreatedAtAction(nameof(GetById), new { id = data.Id },
            ApiResponse<EncfRecibidoResponse>.Ok(data, "XML recibido correctamente"));
    }

    [HttpPost("{id:long}/validar")]
    public async Task<ActionResult<ApiResponse<EncfRecibidoResponse>>> Validar(long id)
    {
        var data = await _service.ValidarAsync(id, Usuario);
        return Ok(ApiResponse<EncfRecibidoResponse>.Ok(data, "Documento validado"));
    }

    [HttpGet("{id:long}/xml")]
    public async Task<IActionResult> GetXml(long id)
    {
        var xml = await _service.GetXmlAsync(id);
        return File(System.Text.Encoding.UTF8.GetBytes(xml), "application/xml", $"encf-recibido-{id}.xml");
    }
}
