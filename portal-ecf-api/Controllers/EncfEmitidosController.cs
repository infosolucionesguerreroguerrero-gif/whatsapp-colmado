using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PortalEcf.Api.Common;
using PortalEcf.Api.Dtos;
using PortalEcf.Api.Services;

namespace PortalEcf.Api.Controllers;

[ApiController]
[Route("api/encf/emitidos")]
[Authorize]
public class EncfEmitidosController : ControllerBase
{
    private readonly IEncfEmitidoService _service;

    public EncfEmitidosController(IEncfEmitidoService service)
    {
        _service = service;
    }

    private string Usuario => User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "sistema";

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResponse<EncfEmitidoResponse>>>> GetList([FromQuery] EncfListFilter filter)
    {
        var data = await _service.GetListAsync(filter);
        return Ok(ApiResponse<PagedResponse<EncfEmitidoResponse>>.Ok(data));
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult<ApiResponse<EncfEmitidoResponse>>> GetById(long id)
    {
        var data = await _service.GetByIdAsync(id);
        return Ok(ApiResponse<EncfEmitidoResponse>.Ok(data));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<EncfEmitidoResponse>>> Crear([FromBody] CrearEncfRequest request)
    {
        var data = await _service.CrearAsync(request, Usuario);
        return CreatedAtAction(nameof(GetById), new { id = data.Id },
            ApiResponse<EncfEmitidoResponse>.Ok(data, "Documento creado correctamente"));
    }

    [HttpPost("{id:long}/enviar-dgii")]
    public async Task<ActionResult<ApiResponse<EnviarDgiiResponse>>> EnviarDgii(long id)
    {
        var data = await _service.EnviarDgiiAsync(id, Usuario, reenvio: false);
        return Ok(ApiResponse<EnviarDgiiResponse>.Ok(data, "Documento enviado a la DGII"));
    }

    [HttpPost("{id:long}/reenviar-dgii")]
    public async Task<ActionResult<ApiResponse<EnviarDgiiResponse>>> ReenviarDgii(long id)
    {
        var data = await _service.EnviarDgiiAsync(id, Usuario, reenvio: true);
        return Ok(ApiResponse<EnviarDgiiResponse>.Ok(data, "Documento reenviado a la DGII"));
    }

    [HttpGet("{id:long}/xml")]
    public async Task<IActionResult> GetXml(long id)
    {
        var xml = await _service.GetXmlAsync(id);
        return File(System.Text.Encoding.UTF8.GetBytes(xml), "application/xml", $"encf-{id}.xml");
    }

    /// <summary>Descarga la representación impresa en PDF (requiere generador de PDF).</summary>
    [HttpGet("{id:long}/pdf")]
    public async Task<IActionResult> GetPdf(long id)
    {
        _ = await _service.GetByIdAsync(id);
        // TODO: integrar generador de PDF (ej. QuestPDF) con la representación impresa del e-CF.
        return StatusCode(StatusCodes.Status501NotImplemented,
            ApiResponse.Fail("La generación de PDF aún no está implementada."));
    }
}
